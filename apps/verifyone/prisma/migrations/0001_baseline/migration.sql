-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 1000,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "dodoCustomerId" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "creditsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateAudit" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "callerKeyHash" TEXT NOT NULL,
    "phoneMasked" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "consent" JSONB,
    "prevHash" TEXT NOT NULL,
    "recordHash" TEXT NOT NULL,
    "recordJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainTail" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "recordHash" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainTail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCredential" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "defaults" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialIdempotency" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'in_progress',
    "responseStatus" INTEGER,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "uniqueRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "columns" JSONB NOT NULL,
    "dataSourceSnapshot" JSONB,
    "simulatedData" BOOLEAN NOT NULL DEFAULT false,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRow" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "original" JSONB NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL,
    "decision" TEXT,
    "reason" TEXT,
    "riskScore" INTEGER,
    "evidenceId" TEXT,

    CONSTRAINT "BulkRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "GateAudit_evidenceId_key" ON "GateAudit"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "GateAudit_seq_key" ON "GateAudit"("seq");

-- CreateIndex
CREATE INDEX "GateAudit_phoneHash_createdAt_idx" ON "GateAudit"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "GateAudit_decision_createdAt_idx" ON "GateAudit"("decision", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCredential_ownerKey_platform_key" ON "PlatformCredential"("ownerKey", "platform");

-- CreateIndex
CREATE INDEX "DialIdempotency_expiresAt_idx" ON "DialIdempotency"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DialIdempotency_ownerKey_idempotencyKey_key" ON "DialIdempotency"("ownerKey", "idempotencyKey");

-- CreateIndex
CREATE INDEX "BulkJob_ownerKey_createdAt_idx" ON "BulkJob"("ownerKey", "createdAt");

-- CreateIndex
CREATE INDEX "BulkJob_status_createdAt_idx" ON "BulkJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BulkJob_expiresAt_idx" ON "BulkJob"("expiresAt");

-- CreateIndex
CREATE INDEX "BulkRow_jobId_status_idx" ON "BulkRow"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BulkRow_jobId_rowIndex_key" ON "BulkRow"("jobId", "rowIndex");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckHistory" ADD CONSTRAINT "CheckHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkRow" ADD CONSTRAINT "BulkRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BulkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

