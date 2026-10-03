-- P5-03: the owner column's default is now a setting the app never sets: the tenancy guard writes every row's owner,
-- and an insert that bypasses it fails here ("unrecognized configuration parameter") instead of filing the row under someone.
-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Step" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "StudySession" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "GoalAction" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "GoalLog" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Book" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "BookMessage" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Skill" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Win" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Pet" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "PetXp" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "ChatThread" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Reminder" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "Email" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "EmailTemplate" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "EmailAttachment" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

-- AlterTable
ALTER TABLE "JobApplication" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');

