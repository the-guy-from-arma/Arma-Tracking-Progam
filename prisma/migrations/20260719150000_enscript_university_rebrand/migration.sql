-- Preserve relational identifiers while moving every current institutional
-- record to the Enscript University identity. Published policy-version content
-- is intentionally immutable; the policy seeder creates material version-four
-- drafts for counsel review and re-consent instead.

UPDATE "User"
SET "academicEmail" = regexp_replace("academicEmail", '@enfusionuniversity\.edu$', '@enscriptuniversity.edu', 'i')
WHERE "academicEmail" ~* '@enfusionuniversity\.edu$';

INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "actionUrl", "dedupeKey", "createdAt")
SELECT
  'enscript-rebrand-' || md5("id"),
  "id",
  'SYSTEM'::"NotificationType",
  'Your Enscript University campus identity is ready',
  'Your internal campus sign-in now uses ' || "academicEmail" || '. Your password and recovery email are unchanged.',
  '/university?view=profile',
  'enscript-university-rebrand:' || "id",
  CURRENT_TIMESTAMP
FROM "User"
WHERE "academicEmail" LIKE '%@enscriptuniversity.edu'
ON CONFLICT ("dedupeKey") DO NOTHING;

UPDATE "User"
SET "studentNumber" = 'ESU-' || substring("studentNumber" from 5)
WHERE "studentNumber" LIKE 'EFU-%';

UPDATE "User"
SET "name" = 'Enscript University Owner'
WHERE "role" = 'OWNER'
  AND "name" IN ('Enfusion University Owner', 'Project VALORIS Owner');

UPDATE "Course"
SET "code" = 'ESU-' || substring("code" from 5)
WHERE "code" LIKE 'EFU-%';

UPDATE "AcademicProgram"
SET "code" = 'ESU-' || substring("code" from 5)
WHERE "code" LIKE 'EFU-%';

UPDATE "Certificate"
SET
  "credentialCode" = CASE
    WHEN "credentialCode" LIKE 'EFU-%' THEN 'ESU-' || substring("credentialCode" from 5)
    ELSE "credentialCode"
  END,
  "issuer" = CASE
    WHEN "issuer" LIKE '%Enfusion University%' THEN replace("issuer", 'Enfusion University', 'Enscript University')
    WHEN "issuer" LIKE '%Enscript University%' THEN "issuer"
    ELSE "issuer" || ' / Enscript University'
  END
WHERE "credentialCode" LIKE 'EFU-%'
   OR "issuer" LIKE '%Enfusion University%'
   OR "issuer" NOT LIKE '%Enscript University%';

UPDATE "ApplicationTracking"
SET "trackingNumber" = 'ESU-' || substring("trackingNumber" from 5)
WHERE "trackingNumber" LIKE 'EFU-%';

UPDATE "PolicySignatureEvent"
SET "receiptNumber" = 'ESU-' || substring("receiptNumber" from 5)
WHERE "receiptNumber" LIKE 'EFU-%';

UPDATE "PolicyInquiry"
SET "trackingNumber" = 'ESU-' || substring("trackingNumber" from 5)
WHERE "trackingNumber" LIKE 'EFU-%';

UPDATE "Notification"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "body" = replace("body", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "body" LIKE '%Enfusion University%';

UPDATE "StudentActivityEvent"
SET
  "title" = replace(replace("title", 'Enfusion University', 'Enscript University'), 'EFU-', 'ESU-'),
  "detail" = replace(replace("detail", 'Enfusion University', 'Enscript University'), 'EFU-', 'ESU-')
WHERE "title" LIKE '%Enfusion University%'
   OR "detail" LIKE '%Enfusion University%'
   OR "title" LIKE '%EFU-%'
   OR "detail" LIKE '%EFU-%';

UPDATE "FundingAward"
SET
  "sourceName" = replace("sourceName", 'Enfusion University', 'Enscript University'),
  "publicDescription" = replace("publicDescription", 'Enfusion University', 'Enscript University'),
  "restrictions" = replace("restrictions", 'Enfusion University', 'Enscript University')
WHERE "sourceName" LIKE '%Enfusion University%'
   OR "publicDescription" LIKE '%Enfusion University%'
   OR "restrictions" LIKE '%Enfusion University%';

UPDATE "GrantLedger"
SET "description" = replace(replace("description", 'Enfusion University', 'Enscript University'), 'EFU-', 'ESU-')
WHERE "description" LIKE '%Enfusion University%'
   OR "description" LIKE '%EFU-%';

UPDATE "Course"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "summary" = replace("summary", 'Enfusion University', 'Enscript University'),
  "deliverable" = replace("deliverable", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "summary" LIKE '%Enfusion University%'
   OR "deliverable" LIKE '%Enfusion University%';

UPDATE "AcademicProgram"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "summary" = replace("summary", 'Enfusion University', 'Enscript University'),
  "credentialTitle" = replace("credentialTitle", 'Enfusion University', 'Enscript University'),
  "audience" = replace("audience", 'Enfusion University', 'Enscript University'),
  "culminatingExperience" = replace("culminatingExperience", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "summary" LIKE '%Enfusion University%'
   OR "credentialTitle" LIKE '%Enfusion University%'
   OR "audience" LIKE '%Enfusion University%'
   OR "culminatingExperience" LIKE '%Enfusion University%';

UPDATE "CourseDay"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "instructionalText" = replace("instructionalText", 'Enfusion University', 'Enscript University'),
  "sourceSection" = replace("sourceSection", 'Enfusion University', 'Enscript University'),
  "practicalLab" = replace("practicalLab", 'Enfusion University', 'Enscript University'),
  "knowledgeQuestion" = replace("knowledgeQuestion", 'Enfusion University', 'Enscript University'),
  "knowledgeAnswer" = replace("knowledgeAnswer", 'Enfusion University', 'Enscript University'),
  "reflectionPrompt" = replace("reflectionPrompt", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "instructionalText" LIKE '%Enfusion University%'
   OR "sourceSection" LIKE '%Enfusion University%'
   OR "practicalLab" LIKE '%Enfusion University%'
   OR "knowledgeQuestion" LIKE '%Enfusion University%'
   OR "knowledgeAnswer" LIKE '%Enfusion University%'
   OR "reflectionPrompt" LIKE '%Enfusion University%';

UPDATE "FacultyConversation"
SET
  "subject" = replace("subject", 'Enfusion University', 'Enscript University'),
  "summary" = replace("summary", 'Enfusion University', 'Enscript University')
WHERE "subject" LIKE '%Enfusion University%'
   OR "summary" LIKE '%Enfusion University%';

UPDATE "FacultyMessage"
SET "body" = replace("body", 'Enfusion University', 'Enscript University')
WHERE "senderRole" IN ('FACULTY', 'SYSTEM')
  AND "body" LIKE '%Enfusion University%';

UPDATE "FacultyProfile"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "specialty" = replace("specialty", 'Enfusion University', 'Enscript University'),
  "biography" = replace("biography", 'Enfusion University', 'Enscript University'),
  "teachingPhilosophy" = replace("teachingPhilosophy", 'Enfusion University', 'Enscript University'),
  "availability" = replace("availability", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "specialty" LIKE '%Enfusion University%'
   OR "biography" LIKE '%Enfusion University%'
   OR "teachingPhilosophy" LIKE '%Enfusion University%'
   OR "availability" LIKE '%Enfusion University%';

UPDATE "Guide"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "summary" = replace("summary", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "summary" LIKE '%Enfusion University%';

UPDATE "GuideStep"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "instruction" = replace("instruction", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "instruction" LIKE '%Enfusion University%';

UPDATE "InstitutionOperationalSetting"
SET
  "publicTitle" = replace("publicTitle", 'Enfusion University', 'Enscript University'),
  "publicMessage" = replace("publicMessage", 'Enfusion University', 'Enscript University')
WHERE "publicTitle" LIKE '%Enfusion University%'
   OR "publicMessage" LIKE '%Enfusion University%';

UPDATE "InstitutionOperationalPeriod"
SET
  "title" = replace("title", 'Enfusion University', 'Enscript University'),
  "publicMessage" = replace("publicMessage", 'Enfusion University', 'Enscript University')
WHERE "title" LIKE '%Enfusion University%'
   OR "publicMessage" LIKE '%Enfusion University%';

ALTER TABLE "GradingRubric"
ALTER COLUMN "promptVersion" SET DEFAULT 'enscript-grader-v1';
