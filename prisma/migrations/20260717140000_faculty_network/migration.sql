ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FACULTY';
CREATE TYPE "FacultyDeliveryMode" AS ENUM ('AUTOMATED','ASSISTED','HUMAN','PAUSED');
CREATE TYPE "FacultyAssignmentType" AS ENUM ('PRIMARY_ADVISOR','COURSE_FACULTY');
CREATE TYPE "FacultyMessageRole" AS ENUM ('STUDENT','FACULTY','SYSTEM');
CREATE TYPE "FacultyJobStatus" AS ENUM ('QUEUED','PROCESSING','COMPLETED','EXCEPTION','FAILED');
CREATE TYPE "FacultyOutreachType" AS ENUM ('WELCOME','WEEKLY_PLAN','INACTIVITY','PROGRESS','FEEDBACK','PREREQUISITE','APPLICATION','FUNDING','COMPLETION');
CREATE TYPE "FacultyEscalationStatus" AS ENUM ('NONE','OPEN','RESOLVED');

CREATE TABLE "FacultyProfile" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "userId" TEXT, "name" TEXT NOT NULL,
  "title" TEXT NOT NULL, "initials" TEXT NOT NULL, "academy" TEXT, "isPrimaryAdvisor" BOOLEAN NOT NULL DEFAULT false,
  "specialty" TEXT NOT NULL, "biography" TEXT NOT NULL, "teachingPhilosophy" TEXT NOT NULL,
  "voice" TEXT NOT NULL, "availability" TEXT NOT NULL DEFAULT 'Available through Campus Messages',
  "boundaries" JSONB NOT NULL DEFAULT '[]', "deliveryMode" "FacultyDeliveryMode" NOT NULL DEFAULT 'AUTOMATED',
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FacultyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyProfile_slug_key" ON "FacultyProfile"("slug");
CREATE UNIQUE INDEX "FacultyProfile_userId_key" ON "FacultyProfile"("userId");
CREATE INDEX "FacultyProfile_academy_active_idx" ON "FacultyProfile"("academy","active");
CREATE INDEX "FacultyProfile_isPrimaryAdvisor_active_idx" ON "FacultyProfile"("isPrimaryAdvisor","active");
ALTER TABLE "FacultyProfile" ADD CONSTRAINT "FacultyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FacultyAssignment" (
  "id" TEXT NOT NULL, "assignmentKey" TEXT NOT NULL, "studentId" TEXT NOT NULL, "facultyProfileId" TEXT NOT NULL,
  "type" "FacultyAssignmentType" NOT NULL, "courseId" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FacultyAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyAssignment_assignmentKey_key" ON "FacultyAssignment"("assignmentKey");
CREATE INDEX "FacultyAssignment_studentId_active_type_idx" ON "FacultyAssignment"("studentId","active","type");
CREATE INDEX "FacultyAssignment_facultyProfileId_active_idx" ON "FacultyAssignment"("facultyProfileId","active");
ALTER TABLE "FacultyAssignment" ADD CONSTRAINT "FacultyAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyAssignment" ADD CONSTRAINT "FacultyAssignment_facultyProfileId_fkey" FOREIGN KEY ("facultyProfileId") REFERENCES "FacultyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyAssignment" ADD CONSTRAINT "FacultyAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentSupportProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "goals" JSONB NOT NULL DEFAULT '[]', "preferences" JSONB NOT NULL DEFAULT '{}',
  "advisorSummary" TEXT, "quietHoursStart" INTEGER NOT NULL DEFAULT 20, "quietHoursEnd" INTEGER NOT NULL DEFAULT 8,
  "outreachEnabled" BOOLEAN NOT NULL DEFAULT true, "lastOutreachAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSupportProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentSupportProfile_userId_key" ON "StudentSupportProfile"("userId");
ALTER TABLE "StudentSupportProfile" ADD CONSTRAINT "StudentSupportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FacultyConversation" (
  "id" TEXT NOT NULL, "conversationKey" TEXT NOT NULL, "studentId" TEXT NOT NULL, "facultyProfileId" TEXT NOT NULL,
  "courseId" TEXT, "subject" TEXT NOT NULL, "summary" TEXT, "muted" BOOLEAN NOT NULL DEFAULT false,
  "escalationStatus" "FacultyEscalationStatus" NOT NULL DEFAULT 'NONE', "lastReadByStudentAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FacultyConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyConversation_conversationKey_key" ON "FacultyConversation"("conversationKey");
CREATE INDEX "FacultyConversation_studentId_lastMessageAt_idx" ON "FacultyConversation"("studentId","lastMessageAt");
CREATE INDEX "FacultyConversation_facultyProfileId_escalationStatus_idx" ON "FacultyConversation"("facultyProfileId","escalationStatus");
ALTER TABLE "FacultyConversation" ADD CONSTRAINT "FacultyConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyConversation" ADD CONSTRAINT "FacultyConversation_facultyProfileId_fkey" FOREIGN KEY ("facultyProfileId") REFERENCES "FacultyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyConversation" ADD CONSTRAINT "FacultyConversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FacultyMessage" (
  "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "senderRole" "FacultyMessageRole" NOT NULL,
  "senderUserId" TEXT, "body" TEXT NOT NULL, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacultyMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FacultyMessage_conversationId_createdAt_idx" ON "FacultyMessage"("conversationId","createdAt");
ALTER TABLE "FacultyMessage" ADD CONSTRAINT "FacultyMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FacultyConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyMessage" ADD CONSTRAINT "FacultyMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FacultyReplyJob" (
  "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "triggerMessageId" TEXT NOT NULL, "responseMessageId" TEXT,
  "status" "FacultyJobStatus" NOT NULL DEFAULT 'QUEUED', "attempt" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FacultyReplyJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyReplyJob_triggerMessageId_key" ON "FacultyReplyJob"("triggerMessageId");
CREATE UNIQUE INDEX "FacultyReplyJob_responseMessageId_key" ON "FacultyReplyJob"("responseMessageId");
CREATE INDEX "FacultyReplyJob_status_availableAt_idx" ON "FacultyReplyJob"("status","availableAt");
ALTER TABLE "FacultyReplyJob" ADD CONSTRAINT "FacultyReplyJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FacultyConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyReplyJob" ADD CONSTRAINT "FacultyReplyJob_triggerMessageId_fkey" FOREIGN KEY ("triggerMessageId") REFERENCES "FacultyMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyReplyJob" ADD CONSTRAINT "FacultyReplyJob_responseMessageId_fkey" FOREIGN KEY ("responseMessageId") REFERENCES "FacultyMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FacultyOutreachEvent" (
  "id" TEXT NOT NULL, "studentId" TEXT NOT NULL, "facultyProfileId" TEXT NOT NULL, "conversationId" TEXT,
  "type" "FacultyOutreachType" NOT NULL, "dedupeKey" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3), "detail" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacultyOutreachEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyOutreachEvent_dedupeKey_key" ON "FacultyOutreachEvent"("dedupeKey");
CREATE INDEX "FacultyOutreachEvent_studentId_scheduledAt_idx" ON "FacultyOutreachEvent"("studentId","scheduledAt");
CREATE INDEX "FacultyOutreachEvent_sentAt_scheduledAt_idx" ON "FacultyOutreachEvent"("sentAt","scheduledAt");
ALTER TABLE "FacultyOutreachEvent" ADD CONSTRAINT "FacultyOutreachEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyOutreachEvent" ADD CONSTRAINT "FacultyOutreachEvent_facultyProfileId_fkey" FOREIGN KEY ("facultyProfileId") REFERENCES "FacultyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacultyOutreachEvent" ADD CONSTRAINT "FacultyOutreachEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FacultyConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FacultyModelAudit" (
  "id" TEXT NOT NULL, "messageId" TEXT NOT NULL, "modelId" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
  "contextSummary" JSONB NOT NULL DEFAULT '{}', "tokenUsage" JSONB NOT NULL DEFAULT '{}', "validation" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FacultyModelAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacultyModelAudit_messageId_key" ON "FacultyModelAudit"("messageId");
ALTER TABLE "FacultyModelAudit" ADD CONSTRAINT "FacultyModelAudit_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "FacultyMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
