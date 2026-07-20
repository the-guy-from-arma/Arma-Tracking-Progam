import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { canTeach, currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { text } from "@/lib/input";
import { refreshProgramProgress } from "@/lib/academic-progress";
import { campusRestrictionResponse } from "@/lib/campus-operations";

const decisions = new Set(["APPROVED", "REVISION_REQUIRED", "DECLINED"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await currentUser();
  if (!reviewer || !canTeach(reviewer.role)) return NextResponse.json({ error: "Faculty review authority required" }, { status: 403 });
  { const gate = await campusRestrictionResponse("GRADING_FINALIZE"); if (gate) return gate; }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision || "");
  const feedback = text(body.feedback, 1200);
  if (!decisions.has(decision)) return NextResponse.json({ error: "Choose an approval, revision, or decline decision." }, { status: 400 });
  if (decision !== "APPROVED" && feedback.length < 10) return NextResponse.json({ error: "Actionable reviewer feedback is required." }, { status: 400 });

  const result = await db.$transaction(async (tx) => {
    const submission = await tx.courseSubmission.findUnique({ where: { id }, include: { course: true, student: { select: { id: true, name: true } } } });
    if (!submission) return null;
    const updated = await tx.courseSubmission.update({ where: { id }, data: { status: decision as never, feedback: feedback || "Approved by studio review.", reviewerId: reviewer.id, reviewedAt: new Date() } });
    await tx.aiGradeDecision.updateMany({ where: { submissionId: id }, data: { status: "OVERRIDDEN" } });
    await tx.submissionAppeal.updateMany({ where: { submissionId: id, status: { in: ["SUBMITTED", "IN_REVIEW"] } }, data: { status: decision === "APPROVED" ? "OVERTURNED" : "UPHELD", reviewerId: reviewer.id, resolution: feedback || "Resolved through studio exception review.", reviewedAt: new Date() } });
    let certificate = null;
    if (decision === "APPROVED") {
      certificate = await tx.certificate.upsert({
        where: { submissionId: id },
        update: { title: submission.course.title, issuer: `${submission.course.studio} / Enscript University`, learningCredits: submission.course.learningCredits },
        create: { credentialCode: `ESU-${crypto.randomBytes(5).toString("hex").toUpperCase()}`, userId: submission.studentId, courseId: submission.courseId, submissionId: id, title: submission.course.title, issuer: `${submission.course.studio} / Enscript University`, learningCredits: submission.course.learningCredits },
      });
      await tx.courseEnrollment.update({ where: { courseId_userId: { courseId: submission.courseId, userId: submission.studentId } }, data: { status: "COMPLETED", progress: 100, completedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorId: reviewer.id, action: `SUBMISSION_${decision}`, entity: "CourseSubmission", entityId: id, detail: { studentId: submission.studentId, courseId: submission.courseId } } });
    return { submission: updated, certificate };
  });
  if (!result) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  if (decision === "APPROVED") await refreshProgramProgress(result.submission.studentId);
  return NextResponse.json(result);
}
