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
  "electronic-records-signature": { heading: "Grouped policy-bundle acceptance", paragraphs: ["The policy bundle is presented inline with every title, version, effective date, checksum, summary, and complete text. Opening each document is encouraged and visually tracked, but a separate checkbox for every document is not required.", "A valid signature requires three grouped affirmations: adult eligibility and application accuracy; acceptance of every listed policy version as one bundle; and consent to electronic records with intent for the typed matching name to act as an electronic signature."] },
};

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
  }
  console.log(`[policies] ${INITIAL_POLICIES.length} base policies and six material version-two drafts are ready for legal review.`);
} finally {
  await db.$disconnect();
}
