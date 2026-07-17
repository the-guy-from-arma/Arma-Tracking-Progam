ALTER TABLE "User" ADD COLUMN "academicEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "studentNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "isStudent" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "User_academicEmail_key" ON "User"("academicEmail");
CREATE UNIQUE INDEX "User_studentNumber_key" ON "User"("studentNumber");
