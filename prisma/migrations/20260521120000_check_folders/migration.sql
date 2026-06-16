-- AlterTable
ALTER TABLE "Check" ADD COLUMN "folder" TEXT;
ALTER TABLE "Check" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Check_projectId_folder_idx" ON "Check"("projectId", "folder");
