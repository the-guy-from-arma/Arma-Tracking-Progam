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
  "terms-of-service": { heading: "Automated admissions and campus calendar", paragraphs: ["Admissions may use deterministic validation and automated academic-readiness review. Coherent applications may be admitted automatically; applications needing more detail may receive focused clarification questions. Automated output alone does not create a permanent denial, and owner review is reserved for exceptions and documented overrides.", "Admissions, new enrollment, or active learning may be paused for scheduled recesses, semester transitions, maintenance, or emergency closure. The public campus status identifies affected services and the expected reopening time. During an academic break, records, policies, lessons in read-only form, and support remain available while academic writes are paused and affected dates are extended by the closure duration."] },
  "ai-automated-systems": { heading: "Automated admissions review", paragraphs: ["Automated admissions may assess completeness, internal consistency, answer specificity, repeated or meaningless text, prompt-injection attempts, URL validity, weekly availability, and stated learning goals. Prior technical expertise is not required for admission.", "The admissions model does not receive or use an applicant's country, veteran status, support needs, recovery credentials, or other protected or unrelated private information to reduce eligibility. Low-confidence or unclear applications receive clarification rather than an automatic permanent denial. Repeated unusable responses, integrity flags, and service failures enter an owner exception queue."] },
  "privacy-student-data": { heading: "Admissions automation data", paragraphs: ["Admissions automation receives only education-relevant application responses, such as technical experience, weekly study availability, learning goals, whether optional evidence links were supplied, and prior clarification answers. Identity traits, country, veteran information, support needs, passwords, recovery credentials, and unrelated private data are excluded from admissions scoring prompts.", "Admissions review decisions, clarification rounds, model identifiers, confidence, validation results, owner overrides, and tracking history are retained as institutional application and audit records."] },
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
