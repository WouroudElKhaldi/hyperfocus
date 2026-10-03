-- P5-10: AI requests per person per day, for the daily limit on the app's shared key.
CREATE TABLE "AiUsage" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT current_setting('hyperfocus.user_id'),
    "day" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiUsage_userId_day_key" ON "AiUsage"("userId", "day");
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
