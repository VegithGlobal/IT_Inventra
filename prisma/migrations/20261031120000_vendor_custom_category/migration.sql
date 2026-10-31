-- Vendor categories become free text: built-in codes (ISP, HARDWARE, ...) stay
-- as they are, and categories added in Settings are stored by name.
ALTER TABLE "Vendor" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Vendor" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "Vendor" ALTER COLUMN "category" SET DEFAULT 'OTHER';

-- Drop the enum first: the new table below takes the same name.
DROP TYPE "VendorCategory";

-- CreateTable
CREATE TABLE "VendorCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorCategory_name_key" ON "VendorCategory"("name");
