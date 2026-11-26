-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "sourceEvidenceId" TEXT,
    "addEvidenceId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,
    "removeReason" TEXT,
    "removeEvidenceId" TEXT,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuppressionEntry_ownerKey_phoneHash_idx" ON "SuppressionEntry"("ownerKey", "phoneHash");

-- Partial unique index: at most ONE active (removedAt IS NULL) entry per ownerKey + phoneHash
CREATE UNIQUE INDEX "SuppressionEntry_active_owner_phone_key" ON "SuppressionEntry"("ownerKey", "phoneHash") WHERE "removedAt" IS NULL;
