-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "gateEvidenceId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "phoneEncrypted" TEXT,
    "reason" TEXT NOT NULL,
    "publicReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "note" TEXT,
    "resolutionEvidenceId" TEXT,
    "approvalExpiresAt" TIMESTAMP(3),
    "approvalUsedAt" TIMESTAMP(3),
    "approvalUsedEvidenceId" TEXT,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewItem_ownerKey_status_createdAt_idx" ON "ReviewItem"("ownerKey", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewItem_ownerKey_phoneHash_idx" ON "ReviewItem"("ownerKey", "phoneHash");

-- Partial unique: at most one OPEN item per ownerKey + phoneHash + reason
CREATE UNIQUE INDEX "ReviewItem_ownerKey_phoneHash_reason_open_key"
  ON "ReviewItem"("ownerKey", "phoneHash", "reason")
  WHERE "status" = 'open';
