-- Add appearance theme for public status pages (light | dark)
ALTER TABLE "StatusPage" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'light';
