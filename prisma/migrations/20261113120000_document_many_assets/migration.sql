-- A document (e.g. one invoice for a bulk purchase) can now link to many assets.

-- CreateTable
CREATE TABLE "_DocumentAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DocumentAssets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DocumentAssets_B_index" ON "_DocumentAssets"("B");

-- AddForeignKey
ALTER TABLE "_DocumentAssets" ADD CONSTRAINT "_DocumentAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentAssets" ADD CONSTRAINT "_DocumentAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep every existing document → asset link ("A" = asset, "B" = document).
INSERT INTO "_DocumentAssets" ("A", "B")
SELECT "assetId", "id" FROM "Document" WHERE "assetId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_assetId_fkey";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "assetId";
