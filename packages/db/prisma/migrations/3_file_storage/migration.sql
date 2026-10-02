-- AlterTable
ALTER TABLE "EmailAttachment" ADD COLUMN     "storageKey" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "data" DROP NOT NULL;

