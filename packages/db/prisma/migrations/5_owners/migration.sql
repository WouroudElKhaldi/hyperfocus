-- P5-02: every row gets an owner. The owner account ("owner") is made first, named after your profile when there is one;
-- every existing row is then assigned to it (the column default). Undo with migration.down.sql (tested: counts are preserved).
INSERT INTO "User" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
VALUES ('owner', COALESCE((SELECT "name" FROM "Profile" WHERE "name" <> '' LIMIT 1), 'You'), 'owner@localhost', true, now(), now())
ON CONFLICT ("id") DO NOTHING;

-- DropIndex
DROP INDEX "PetXp_key_key";

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Step" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "GoalAction" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "GoalLog" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "BookMessage" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Win" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "PetXp" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "EmailAttachment" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "userId" TEXT NOT NULL DEFAULT 'owner';

-- CreateIndex
CREATE INDEX "Note_userId_idx" ON "Note"("userId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Step_userId_idx" ON "Step"("userId");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "StudySession_userId_idx" ON "StudySession"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "GoalAction_userId_idx" ON "GoalAction"("userId");

-- CreateIndex
CREATE INDEX "GoalLog_userId_idx" ON "GoalLog"("userId");

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");

-- CreateIndex
CREATE INDEX "Book_userId_idx" ON "Book"("userId");

-- CreateIndex
CREATE INDEX "BookMessage_userId_idx" ON "BookMessage"("userId");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Win_userId_idx" ON "Win"("userId");

-- CreateIndex
CREATE INDEX "Pet_userId_idx" ON "Pet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Pet_userId_key" ON "Pet"("userId");

-- CreateIndex
CREATE INDEX "PetXp_userId_idx" ON "PetXp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PetXp_userId_key_key" ON "PetXp"("userId", "key");

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");

-- CreateIndex
CREATE INDEX "Email_userId_idx" ON "Email"("userId");

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_idx" ON "EmailTemplate"("userId");

-- CreateIndex
CREATE INDEX "EmailAttachment_userId_idx" ON "EmailAttachment"("userId");

-- CreateIndex
CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Step" ADD CONSTRAINT "Step_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAction" ADD CONSTRAINT "GoalAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalLog" ADD CONSTRAINT "GoalLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookMessage" ADD CONSTRAINT "BookMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Win" ADD CONSTRAINT "Win_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PetXp" ADD CONSTRAINT "PetXp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

