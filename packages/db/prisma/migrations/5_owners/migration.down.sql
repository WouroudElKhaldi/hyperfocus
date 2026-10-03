-- Undoes 5_owners (P5-02): removes the owner columns and puts back the old uniqueness of pet points. Not run by Prisma:
-- run it by hand if ever needed (pnpm --filter @hyperfocus/db exec prisma db execute --file prisma/migrations/5_owners/migration.down.sql),
-- then delete the 5_owners row from _prisma_migrations. Rows are never deleted.
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- DropForeignKey
ALTER TABLE "Step" DROP CONSTRAINT "Step_userId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";

-- DropForeignKey
ALTER TABLE "StudySession" DROP CONSTRAINT "StudySession_userId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_userId_fkey";

-- DropForeignKey
ALTER TABLE "GoalAction" DROP CONSTRAINT "GoalAction_userId_fkey";

-- DropForeignKey
ALTER TABLE "GoalLog" DROP CONSTRAINT "GoalLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_userId_fkey";

-- DropForeignKey
ALTER TABLE "Book" DROP CONSTRAINT "Book_userId_fkey";

-- DropForeignKey
ALTER TABLE "BookMessage" DROP CONSTRAINT "BookMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_userId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "Win" DROP CONSTRAINT "Win_userId_fkey";

-- DropForeignKey
ALTER TABLE "Pet" DROP CONSTRAINT "Pet_userId_fkey";

-- DropForeignKey
ALTER TABLE "PetXp" DROP CONSTRAINT "PetXp_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatThread" DROP CONSTRAINT "ChatThread_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Reminder" DROP CONSTRAINT "Reminder_userId_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTemplate" DROP CONSTRAINT "EmailTemplate_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailAttachment" DROP CONSTRAINT "EmailAttachment_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_userId_fkey";

-- DropIndex
DROP INDEX "Note_userId_idx";

-- DropIndex
DROP INDEX "Task_userId_idx";

-- DropIndex
DROP INDEX "Step_userId_idx";

-- DropIndex
DROP INDEX "Post_userId_idx";

-- DropIndex
DROP INDEX "StudySession_userId_idx";

-- DropIndex
DROP INDEX "Goal_userId_idx";

-- DropIndex
DROP INDEX "GoalAction_userId_idx";

-- DropIndex
DROP INDEX "GoalLog_userId_idx";

-- DropIndex
DROP INDEX "Event_userId_idx";

-- DropIndex
DROP INDEX "Book_userId_idx";

-- DropIndex
DROP INDEX "BookMessage_userId_idx";

-- DropIndex
DROP INDEX "Skill_userId_idx";

-- DropIndex
DROP INDEX "Review_userId_idx";

-- DropIndex
DROP INDEX "Win_userId_idx";

-- DropIndex
DROP INDEX "Pet_userId_idx";

-- DropIndex
DROP INDEX "Pet_userId_key";

-- DropIndex
DROP INDEX "PetXp_userId_idx";

-- DropIndex
DROP INDEX "PetXp_userId_key_key";

-- DropIndex
DROP INDEX "ChatThread_userId_idx";

-- DropIndex
DROP INDEX "ChatMessage_userId_idx";

-- DropIndex
DROP INDEX "Profile_userId_idx";

-- DropIndex
DROP INDEX "Profile_userId_key";

-- DropIndex
DROP INDEX "Reminder_userId_idx";

-- DropIndex
DROP INDEX "Email_userId_idx";

-- DropIndex
DROP INDEX "EmailTemplate_userId_idx";

-- DropIndex
DROP INDEX "EmailAttachment_userId_idx";

-- DropIndex
DROP INDEX "JobApplication_userId_idx";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Step" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "StudySession" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Goal" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "GoalAction" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "GoalLog" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Book" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "BookMessage" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Skill" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Win" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Pet" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "PetXp" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "ChatThread" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Reminder" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "EmailTemplate" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "EmailAttachment" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "JobApplication" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "PetXp_key_key" ON "PetXp"("key");


-- the owner account goes too, unless it was given a real sign-in since
DELETE FROM "User" WHERE "id" = 'owner' AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "userId" = 'owner');
