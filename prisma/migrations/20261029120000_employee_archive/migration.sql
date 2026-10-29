-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Employee_archivedAt_idx" ON "Employee"("archivedAt");

-- The old "Archive" hid employees with deletedAt; move them to the Archived tab instead.
UPDATE "Employee" SET "archivedAt" = "deletedAt", "deletedAt" = NULL WHERE "deletedAt" IS NOT NULL;
