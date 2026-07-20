import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGuardianAccessToken } from "@/lib/guardian-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Applicant sign-in required." }, { status: 401 });
  const application = await db.studentApplication.findUnique({
    where: { userId: user.id },
    include: { guardianConsent: true },
  });
  if (!application?.guardianConsent || ![16, 17].includes(application.ageAtSubmission || -1))
    return NextResponse.json({ error: "This application does not require guardian verification." }, { status: 409 });
  if (application.guardianConsent.status === "VERIFIED")
    return NextResponse.json({ error: "Guardian verification is already complete." }, { status: 409 });
  const access = createGuardianAccessToken();
  await db.$transaction([
    db.guardianConsent.update({
      where: { id: application.guardianConsent.id },
      data: {
        accessTokenHash: access.accessTokenHash,
        tokenExpiresAt: access.tokenExpiresAt,
        status: application.guardianConsent.status === "ALTERNATIVE_REVIEW" ? "ALTERNATIVE_REVIEW" : "INVITED",
      },
    }),
    db.auditLog.create({
      data: { actorId: user.id, action: "GUARDIAN_INVITATION_ROTATED", entity: "GuardianConsent", entityId: application.guardianConsent.id, detail: { expiresAt: access.tokenExpiresAt } },
    }),
  ]);
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    invitationUrl: `${origin}/guardian-consent/${access.token}`,
    expiresAt: access.tokenExpiresAt,
  });
}
