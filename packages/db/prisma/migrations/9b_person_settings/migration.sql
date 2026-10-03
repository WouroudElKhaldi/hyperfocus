-- P5-11: settings per person (they were one settings.json for everyone), and every outbox message belongs to someone,
-- unique per person (two people's "morning:<day>" nudges are two messages).
CREATE TABLE "UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT current_setting('hyperfocus.user_id'),
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- the messages so far were the owner's (the only person before accounts)
ALTER TABLE "OutboxMessage" ADD COLUMN "userId" TEXT;
UPDATE "OutboxMessage" SET "userId" = 'owner';
ALTER TABLE "OutboxMessage" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "OutboxMessage" ALTER COLUMN "userId" SET DEFAULT current_setting('hyperfocus.user_id');
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX "OutboxMessage_key_key";
CREATE UNIQUE INDEX "OutboxMessage_userId_key_key" ON "OutboxMessage"("userId", "key");
CREATE INDEX "OutboxMessage_userId_idx" ON "OutboxMessage"("userId");
