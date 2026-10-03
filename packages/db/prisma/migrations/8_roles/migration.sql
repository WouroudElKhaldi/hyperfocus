-- P5-06: roles (user, admin) and feature flags. The owner account is an admin.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
UPDATE "User" SET "role" = 'admin' WHERE "id" = 'owner';

CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);
