-- CreateTable
CREATE TABLE "PublicScan" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "scanId" TEXT,
    "consentToContact" BOOLEAN NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicScan_ipHash_createdAt_idx" ON "PublicScan"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "PublicScan_createdAt_idx" ON "PublicScan"("createdAt");

-- CreateIndex
CREATE INDEX "ScanLead_email_idx" ON "ScanLead"("email");

-- CreateIndex
CREATE INDEX "ScanLead_createdAt_idx" ON "ScanLead"("createdAt");

