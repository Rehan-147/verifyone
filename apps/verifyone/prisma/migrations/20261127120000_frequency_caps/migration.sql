-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "callCap24h" INTEGER;

-- CreateTable
CREATE TABLE "CallAttempt" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallAttempt_ownerKey_phoneHash_createdAt_idx" ON "CallAttempt"("ownerKey", "phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "CallAttempt_createdAt_idx" ON "CallAttempt"("createdAt");

