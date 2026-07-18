import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { policyGateResponse } from "@/lib/policies";

export const runtime = "nodejs";
const TYPES = new Set(["transcript", "enrollment-verification", "program-audit", "sponsored-learning-statement"]);
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export async function GET(_: Request, context: { params: Promise<{ type: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const gate = await policyGateResponse(user.id); if (gate) return gate;
  const { type } = await context.params; if (!TYPES.has(type)) return NextResponse.json({ error: "Unknown student document" }, { status: 404 });
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: {
    name: true, studentNumber: true, academicEmail: true, grantBalanceCents: true,
    courseEnrollments: { include: { course: { select: { code: true, title: true, learningCredits: true } } }, orderBy: { enrolledAt: "asc" } },
    programEnrollments: { include: { program: { select: { code: true, title: true, level: true, creditsRequired: true } } }, orderBy: { enrolledAt: "desc" } },
    certificates: { select: { title: true, credentialCode: true, issuedAt: true, learningCredits: true } },
    grantLedger: { select: { type: true, description: true, amountCents: true, createdAt: true, runningBalanceCents: true }, orderBy: { createdAt: "desc" }, take: 80 },
  } });
  const titles: Record<string, string> = { transcript: "Institutional Transcript", "enrollment-verification": "Enrollment Verification", "program-audit": "Program Audit", "sponsored-learning-statement": "Sponsored-Learning Statement" };
  const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]); let y = 735;
  const line = (value: string, size = 10, weight = regular, color = rgb(.13, .2, .28), indent = 0) => {
    if (y < 72) { page = pdf.addPage([612, 792]); y = 740; }
    const safe = value.replace(/[^\x20-\x7E]/g, ""); page.drawText(safe.slice(0, 105), { x: 54 + indent, y, size, font: weight, color }); y -= size + 7;
  };
  line("ENFUSION UNIVERSITY", 15, bold, rgb(.04, .19, .32)); line(titles[type], 24, bold); line(`Issued ${new Date().toLocaleString()} | Document ID ${crypto.randomUUID().toUpperCase()}`, 8, regular, rgb(.38, .46, .53)); y -= 14;
  line(record.name, 16, bold); line(`Student ID: ${record.studentNumber || "PENDING"} | Campus ID: ${record.academicEmail || "Not issued"}`, 9); y -= 12;
  if (type === "enrollment-verification") {
    const active = record.courseEnrollments.filter((item) => item.status === "ACTIVE"); line("Enrollment status", 12, bold); line(active.length ? `ACTIVE - ${active.length} current course${active.length === 1 ? "" : "s"}` : "No active course enrollment", 11); active.forEach((item) => line(`${item.course.code}  ${item.course.title}`, 9, regular, undefined, 12));
  } else if (type === "sponsored-learning-statement") {
    line("Account summary", 12, bold); line(`Available internal sponsored-learning value: ${money(record.grantBalanceCents)}`, 11); line("Student responsibility: $0.00 | Payment status: No payment required", 10, bold); y -= 8; line("Reconciled activity", 12, bold); record.grantLedger.forEach((item) => line(`${new Date(item.createdAt).toLocaleDateString()}  ${item.description}  ${item.amountCents >= 0 ? "+" : ""}${money(item.amountCents)}`, 8));
  } else if (type === "program-audit") {
    const enrollment = record.programEnrollments[0]; line("Active academic pathway", 12, bold); if (!enrollment) line("No program enrollment is currently recorded."); else { line(`${enrollment.program.code}  ${enrollment.program.title}`, 11, bold); line(`Pathway level: ${enrollment.program.level} | Recorded credits: ${enrollment.creditsEarned} of ${enrollment.program.creditsRequired}`); }
    y -= 8; line("Completed coursework and credentials", 12, bold); record.courseEnrollments.filter((item) => item.status === "COMPLETED").forEach((item) => line(`${item.course.code}  ${item.course.title}  ${item.course.learningCredits} credits`, 9)); record.certificates.forEach((item) => line(`${item.credentialCode}  ${item.title}  ${item.learningCredits} credits`, 9));
  } else {
    line("Institutional course record", 12, bold); record.courseEnrollments.forEach((item) => line(`${item.course.code}  ${item.course.title}  ${item.status}  ${item.progress}%  ${item.course.learningCredits} credits`, 9)); y -= 8; line("Credentials", 12, bold); record.certificates.forEach((item) => line(`${item.credentialCode}  ${item.title}  issued ${new Date(item.issuedAt).toLocaleDateString()}`, 9));
  }
  y -= 18; line("INSTITUTIONAL DISCLOSURE", 9, bold, rgb(.45, .2, .16)); line("Enfusion University is an independent, non-accredited online learning institution. These records are private institutional records and do not guarantee transfer, licensure, employer acceptance, or accredited degree status.", 8); if (type === "sponsored-learning-statement") line("All dollar figures are internal noncash service-value statistics. They are not tuition, financial aid, cash, a loan, stored value, or student debt. Student responsibility is always $0.00.", 8);
  const bytes = await pdf.save();
  await db.auditLog.create({ data: { actorId: user.id, action: "STUDENT_DOCUMENT_DOWNLOADED", entity: "StudentDocument", detail: { type } } });
  return new NextResponse(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename=\"enfusion-${type}-${record.studentNumber || "student"}.pdf\"`, "cache-control": "private, no-store" } });
}
