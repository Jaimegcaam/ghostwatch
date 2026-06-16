-- Persist DNS verification state per custom domain.
ALTER TABLE "StatusPageCustomDomain"
    ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verifiedAt" TIMESTAMP(3);
