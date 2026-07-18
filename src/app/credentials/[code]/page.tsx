import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credential verification" };

export default async function CredentialPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const credential = await db.certificate.findUnique({
    where: { credentialCode: code.toUpperCase() },
    include: {
      user: { select: { name: true } },
      course: { select: { code: true, studio: true } },
    },
  });
  if (!credential) notFound();
  return (
    <main className="credentialPage">
      <section className="credentialSheet">
        <header>
          <div className="credentialLogo"><Image src="/enfusion-university-lockup.png" alt="Enfusion University" width={1600} height={388}/></div>
          <div>
            <p>ENFUSION UNIVERSITY</p>
            <strong>VERIFIED ACADEMIC RECORD</strong>
          </div>
        </header>
        <p className="credentialOverline">CERTIFICATE OF COMPLETION</p>
        <h1>{credential.title}</h1>
        <p className="credentialAwarded">Awarded to</p>
        <h2>{credential.user.name}</h2>
        <p className="credentialCopy">
          For completing the assessed development deliverable and passing studio
          review through {credential.course.studio}.
        </p>
        <div className="credentialMeta">
          <span>
            <small>CREDENTIAL</small>
            {credential.credentialCode}
          </span>
          <span>
            <small>COURSE</small>
            {credential.course.code}
          </span>
          <span>
            <small>ISSUED</small>
            {credential.issuedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          <span>
            <small>LEARNING CREDIT</small>
            {credential.learningCredits} institutional credits
          </span>
        </div>
        <footer>
          <strong>{credential.issuer}</strong>
          <p>
            Enfusion University credentials document independent learning and
            portfolio assessment. They are not accredited college credit or an
            accredited academic degree unless a recognized institution
            separately confirms acceptance.
          </p>
        </footer>
      </section>
    </main>
  );
}
