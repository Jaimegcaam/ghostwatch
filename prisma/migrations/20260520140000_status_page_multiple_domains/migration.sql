-- Multiple custom domains per status page (each domain still unique globally).
CREATE TABLE "StatusPageCustomDomain" (
    "id" TEXT NOT NULL,
    "statusPageId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusPageCustomDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusPageCustomDomain_domain_key" ON "StatusPageCustomDomain"("domain");
CREATE INDEX "StatusPageCustomDomain_statusPageId_idx" ON "StatusPageCustomDomain"("statusPageId");

ALTER TABLE "StatusPageCustomDomain" ADD CONSTRAINT "StatusPageCustomDomain_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StatusPageCustomDomain" ("id", "statusPageId", "domain", "createdAt")
SELECT
    'mig_' || "id",
    "id",
    lower(trim("customDomain")),
    NOW()
FROM "StatusPage"
WHERE "customDomain" IS NOT NULL AND trim("customDomain") <> '';

DROP INDEX IF EXISTS "StatusPage_customDomain_key";
ALTER TABLE "StatusPage" DROP COLUMN "customDomain";
