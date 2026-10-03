-- P5-07: each person's connected accounts, their tokens sealed by the app (never readable here).
CREATE TABLE "Integration" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL DEFAULT current_setting('hyperfocus.user_id'),
    "provider" TEXT NOT NULL,
    "account" TEXT NOT NULL DEFAULT '',
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Integration_userId_provider_key" ON "Integration"("userId", "provider");
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
