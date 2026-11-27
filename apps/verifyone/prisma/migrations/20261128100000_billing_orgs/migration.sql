-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "dodoSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "orgId" TEXT,
    "email" TEXT,
    "plan" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "grantPaymentId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_webhookId_key" ON "PaymentEvent"("webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_grantPaymentId_key" ON "PaymentEvent"("grantPaymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_subscriptionId_status_idx" ON "PaymentEvent"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "PaymentEvent_orgId_createdAt_idx" ON "PaymentEvent"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_dodoSubscriptionId_key" ON "Organization"("dodoSubscriptionId");

