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
  }
  console.log(`[policies] ${INITIAL_POLICIES.length} immutable version-one drafts are ready for legal and trademark review.`);
} finally {
  await db.$disconnect();
}
