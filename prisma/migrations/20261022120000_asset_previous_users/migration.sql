-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "previousUsers" TEXT[] DEFAULT ARRAY[]::TEXT[];
