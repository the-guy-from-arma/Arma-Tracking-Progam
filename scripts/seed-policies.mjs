import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { PrismaClient } from "@prisma/client";

const source = fs.readFileSync(new URL("../src/lib/policy-documents.ts", import.meta.url), "utf8");
const declaration = source.indexOf("export const INITIAL_POLICIES");
const arrayStart = source.indexOf("[", declaration);
const arrayEnd = source.lastIndexOf("];");
if (declaration < 0 || arrayStart < 0 || arrayEnd < arrayStart) throw new Error("Policy source could not be parsed.");
const INITIAL_POLICIES = vm.runInNewContext(`(${source.slice(arrayStart, arrayEnd + 1)})`, Object.create(null), { timeout: 1000 });

const db = new PrismaClient();
const checksum = (content) => crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
const revisionSections = {
  "terms-of-service": { heading: "Automated admissions and campus calendar", paragraphs: ["Admissions uses deterministic completeness validation and staged processing. Applications that satisfy the published required fields may be admitted automatically. Generative AI does not interpret or score application narratives for admission, and owner review remains available for documented exceptions and overrides.", "Admissions, new enrollment, or active learning may be paused for scheduled recesses, semester transitions, maintenance, or emergency closure. The public campus status identifies affected services and the expected reopening time. During an academic break, records, policies, lessons in read-only form, and support remain available while academic writes are paused and affected dates are extended by the closure duration."] },
  "ai-automated-systems": { heading: "Admissions processing", paragraphs: ["Admissions does not use Gemini or another generative model to interpret, rank, or score an applicant's written answers. Required application fields are validated and the application moves through a deterministic processing queue before admission is finalized.", "Country, veteran status, support needs, recovery credentials, and other protected or unrelated private information do not control the admissions decision. An owner may intervene only for documented exceptions or corrections."] },
  "privacy-student-data": { heading: "Admissions processing data", paragraphs: ["Application responses are retained as part of the admissions record but are not sent to a generative AI model for admissions scoring. Identity traits, country, veteran information, support needs, passwords, recovery credentials, and unrelated private data do not control automated admission.", "Admissions processing status, validation results, owner overrides, and tracking history are retained as institutional application and audit records."] },
  "academic-integrity-appeals": { heading: "Academic breaks and deadline protection", paragraphs: ["During a published academic break, students may read lessons and access records and support, but lesson completion, quizzes, submissions, grading finalization, withdrawals, enrollment, and credential completion are paused. The system preserves unfinished work and queued reviews.", "Active course dates and funding-term end dates are extended once by the exact scheduled break duration. Maintenance and emergency closures may restrict additional services while policies, signed receipts, closure information, and support remain accessible."] },
  "credentials-institutional-status": { heading: "Completion timing during campus closures", paragraphs: ["Credential completion and final academic decisions may pause during a scheduled break, maintenance period, or emergency closure. Eligible completed work remains preserved and resumes through the normal review process after reopening."] },
  "electronic-records-signature": { heading: "Grouped policy-bundle acceptance", paragraphs: ["The policy bundle is presented inline with every title, version, effective date, checksum, summary, and complete text. Opening each document is encouraged and visually tracked, but a separate checkbox for every document is not required.", "A valid signature requires three grouped affirmations: age eligibility and application accuracy; acceptance of every listed policy version as one bundle; and consent to electronic records with intent for the typed matching name to act as an electronic signature."] },
};
const guardianRevisionSections = {
  "terms-of-service": { heading: "Applicants age 16 or 17", paragraphs: ["Admission is available beginning at age 16. Before a 16- or 17-year-old applicant may be admitted, a parent or legal guardian must complete a separate electronic consent and adult identity-verification record. The student account, campus identity, sponsored-learning award, and orientation enrollment are withheld until verification succeeds.", "The guardian may request an accessible alternative verification route. An automated or provider failure does not by itself deny the applicant. The Operators may require additional evidence or legal review where identity, parental responsibility, or jurisdictional requirements cannot be confirmed."] },
  "privacy-student-data": { heading: "Guardian consent and age assurance", paragraphs: ["For applicants age 16 or 17, the university records date of birth plus the guardian's name, email, relationship, consent statements, typed signature, provider session reference, status, adult-verification result, name-match result, timestamps, and limited audit metadata. The university does not retain the guardian's government-ID image, ID number, or selfie.", "The hosted provider processes identity evidence under its own privacy terms. Verification results may be challenged through the Policy Contact system. A privacy-preserving alternative route is available when document verification is inaccessible or inappropriate. These controls are designed around data minimization and proportional age assurance; they are not a representation that one workflow satisfies every law without jurisdiction-specific legal review."] },
};
const guardianPolicySlugs = new Set(["terms-of-service", "ai-automated-systems", "privacy-student-data", "electronic-records-signature"]);

try {
  await db.institutionPolicySetting.upsert({
    where: { id: "institution-policy" },
    update: {},
    create: { id: "institution-policy", gateActive: false, aiDataMode: "UNCONFIRMED_OR_UNPAID" },
  });
  for (const [index, policy] of INITIAL_POLICIES.entries()) {
    const document = await db.policyDocument.upsert({
      where: { slug: policy.slug },
      update: { title: policy.title, summary: policy.summary, sortOrder: index + 1, mandatory: true },
      create: { slug: policy.slug, title: policy.title, summary: policy.summary, sortOrder: index + 1, mandatory: true },
    });
    await db.policyVersion.upsert({
      where: { documentId_version: { documentId: document.id, version: 1 } },
      update: {},
      create: { documentId: document.id, version: 1, content: policy.content, checksum: checksum(policy.content), revisionNote: "Initial counsel-review draft", status: "DRAFT", materialChange: true },
    });
    const revision = revisionSections[policy.slug];
    if (revision) {
      const revisedContent = structuredClone(policy.content);
      revisedContent.sections.push(revision);
      await db.policyVersion.upsert({
        where: { documentId_version: { documentId: document.id, version: 2 } },
        update: {},
        create: { documentId: document.id, version: 2, content: revisedContent, checksum: checksum(revisedContent), revisionNote: "Automated admissions, campus operations, and grouped electronic consent", status: "DRAFT", materialChange: true },
      });
    }
    const guardianRevision = guardianRevisionSections[policy.slug];
    if (guardianPolicySlugs.has(policy.slug)) {
      const versionTwoContent = structuredClone(policy.content);
      if (revision) versionTwoContent.sections.push(revision);
      if (guardianRevision) versionTwoContent.sections.push(guardianRevision);
      await db.policyVersion.upsert({
        where: { documentId_version: { documentId: document.id, version: 3 } },
        update: {},
        create: { documentId: document.id, version: 3, content: versionTwoContent, checksum: checksum(versionTwoContent), revisionNote: "Applicants age 16–17, guardian consent, and privacy-minimized age assurance", status: "DRAFT", materialChange: true },
      });
    }
    const rebrandNote = "Institutional rebrand to Enscript University";
    const existingRebrand = await db.policyVersion.findFirst({
      where: { documentId: document.id, revisionNote: rebrandNote },
      select: { id: true },
    });
    if (!existingRebrand) {
      const latest = await db.policyVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { version: "desc" },
        select: { version: true, content: true },
      });
      const rebrandedContent = JSON.parse(
        JSON.stringify(latest?.content || policy.content)
          .replaceAll("Enfusion University", "Enscript University")
          .replaceAll("enfusionuniversity.edu", "enscriptuniversity.edu")
          .replaceAll("EFU-", "ESU-"),
      );
      await db.policyVersion.create({
        data: {
          documentId: document.id,
          version: (latest?.version || 0) + 1,
          content: rebrandedContent,
          checksum: checksum(rebrandedContent),
          revisionNote: rebrandNote,
          status: "DRAFT",
          materialChange: true,
        },
      });
    }
  }
  console.log(`[policies] ${INITIAL_POLICIES.length} base policies and Enscript University rebrand drafts are ready for legal review.`);
} finally {
  await db.$disconnect();
}
