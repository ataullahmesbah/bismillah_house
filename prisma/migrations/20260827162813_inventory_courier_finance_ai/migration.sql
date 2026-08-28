-- CreateEnum
CREATE TYPE "IncomingStockStatus" AS ENUM ('DRAFT', 'EXPECTED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('CASH', 'BANK', 'MOBILE_WALLET', 'COURIER_RECEIVABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED', 'APPLIED', 'DISCARDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'RECEIVED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'DAMAGED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'LOST';
ALTER TYPE "InventoryMovementType" ADD VALUE 'EXPIRED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE 'COUNT_CORRECTION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ShipmentStatus" ADD VALUE 'CREATED';
ALTER TYPE "ShipmentStatus" ADD VALUE 'PICKUP_PENDING';
ALTER TYPE "ShipmentStatus" ADD VALUE 'AT_HUB';
ALTER TYPE "ShipmentStatus" ADD VALUE 'AT_DESTINATION';
ALTER TYPE "ShipmentStatus" ADD VALUE 'HOLD';

-- AlterTable
ALTER TABLE "couriers" ADD COLUMN     "defaultCharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "unitCost" INTEGER,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "lastRestockedAt" TIMESTAMP(3),
ADD COLUMN     "reorderLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockDamaged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockIncoming" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockReserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "lastRestockedAt" TIMESTAMP(3),
ADD COLUMN     "reorderLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockDamaged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockIncoming" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockReserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "collectedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consignmentId" TEXT,
ADD COLUMN     "courierCharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "currentLocation" TEXT,
ADD COLUMN     "deliveryManName" TEXT,
ADD COLUMN     "deliveryManPhone" TEXT,
ADD COLUMN     "estimatedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "pickupAt" TIMESTAMP(3),
ADD COLUMN     "settledAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settlementNote" TEXT,
ADD COLUMN     "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "syncAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncError" TEXT;

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_incoming" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierPhone" TEXT,
    "warehouseId" TEXT,
    "status" "IncomingStockStatus" NOT NULL DEFAULT 'EXPECTED',
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_incoming_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_incoming_items" (
    "id" TEXT NOT NULL,
    "incomingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_incoming_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courier_dispatch_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "courierCode" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "request" JSONB,
    "response" JSONB,
    "errorMessage" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_dispatch_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "FinanceAccountType" NOT NULL DEFAULT 'CASH',
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "accountNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "amount" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "vendorName" TEXT,
    "employeeId" TEXT,
    "orderId" TEXT,
    "shipmentId" TEXT,
    "attachmentUrl" TEXT,
    "note" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transaction_revisions" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_transaction_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_product_drafts" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "productId" TEXT,
    "actorId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_product_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_isActive_position_idx" ON "warehouses"("isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "stock_incoming_reference_key" ON "stock_incoming"("reference");

-- CreateIndex
CREATE INDEX "stock_incoming_status_expectedAt_idx" ON "stock_incoming"("status", "expectedAt");

-- CreateIndex
CREATE INDEX "stock_incoming_items_incomingId_idx" ON "stock_incoming_items"("incomingId");

-- CreateIndex
CREATE INDEX "stock_incoming_items_productId_idx" ON "stock_incoming_items"("productId");

-- CreateIndex
CREATE INDEX "shipment_events_shipmentId_occurredAt_idx" ON "shipment_events"("shipmentId", "occurredAt");

-- CreateIndex
CREATE INDEX "courier_dispatch_logs_orderId_createdAt_idx" ON "courier_dispatch_logs"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "courier_dispatch_logs_success_createdAt_idx" ON "courier_dispatch_logs"("success", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_code_key" ON "finance_accounts"("code");

-- CreateIndex
CREATE INDEX "finance_accounts_isActive_position_idx" ON "finance_accounts"("isActive", "position");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_slug_key" ON "expense_categories"("slug");

-- CreateIndex
CREATE INDEX "expense_categories_kind_position_idx" ON "expense_categories"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "finance_transactions_reference_key" ON "finance_transactions"("reference");

-- CreateIndex
CREATE INDEX "finance_transactions_kind_occurredAt_idx" ON "finance_transactions"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_transactions_categoryId_occurredAt_idx" ON "finance_transactions"("categoryId", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_transactions_orderId_idx" ON "finance_transactions"("orderId");

-- CreateIndex
CREATE INDEX "finance_transactions_occurredAt_idx" ON "finance_transactions"("occurredAt");

-- CreateIndex
CREATE INDEX "finance_transactions_voidedAt_idx" ON "finance_transactions"("voidedAt");

-- CreateIndex
CREATE INDEX "finance_transaction_revisions_transactionId_createdAt_idx" ON "finance_transaction_revisions"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_createdAt_idx" ON "ai_usage_logs"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_provider_createdAt_idx" ON "ai_usage_logs"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "ai_product_drafts_status_createdAt_idx" ON "ai_product_drafts"("status", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_warehouseId_createdAt_idx" ON "inventory_movements"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_type_createdAt_idx" ON "inventory_movements"("type", "createdAt");

-- CreateIndex
CREATE INDEX "shipments_consignmentId_idx" ON "shipments"("consignmentId");

-- CreateIndex
CREATE INDEX "shipments_status_updatedAt_idx" ON "shipments"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "shipments_settlementStatus_idx" ON "shipments"("settlementStatus");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_incoming" ADD CONSTRAINT "stock_incoming_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_incoming" ADD CONSTRAINT "stock_incoming_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_incoming_items" ADD CONSTRAINT "stock_incoming_items_incomingId_fkey" FOREIGN KEY ("incomingId") REFERENCES "stock_incoming"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_incoming_items" ADD CONSTRAINT "stock_incoming_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_incoming_items" ADD CONSTRAINT "stock_incoming_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_dispatch_logs" ADD CONSTRAINT "courier_dispatch_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_dispatch_logs" ADD CONSTRAINT "courier_dispatch_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transaction_revisions" ADD CONSTRAINT "finance_transaction_revisions_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "finance_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_product_drafts" ADD CONSTRAINT "ai_product_drafts_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_product_drafts" ADD CONSTRAINT "ai_product_drafts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
