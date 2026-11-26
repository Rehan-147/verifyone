-- AlterTable
ALTER TABLE "SuppressionEntry"
ALTER COLUMN "phoneEncrypted" DROP NOT NULL,
ALTER COLUMN "addEvidenceId" DROP NOT NULL;
