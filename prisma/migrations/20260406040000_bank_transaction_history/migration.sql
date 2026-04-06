-- AlterTable: AccountingTransaction に入出金履歴用フィールドを追加
ALTER TABLE "accounting_transactions" ADD COLUMN "balance" INTEGER;
ALTER TABLE "accounting_transactions" ADD COLUMN "operatingCompanyId" INTEGER;
ALTER TABLE "accounting_transactions" ADD COLUMN "deduplicationHash" VARCHAR(64);

-- CreateIndex
CREATE INDEX "accounting_transactions_operatingCompanyId_idx" ON "accounting_transactions"("operatingCompanyId");
CREATE INDEX "accounting_transactions_deduplicationHash_idx" ON "accounting_transactions"("deduplicationHash");

-- AddForeignKey
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: MoneyForwardConnection
CREATE TABLE "money_forward_connections" (
    "id" SERIAL NOT NULL,
    "operatingCompanyId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "mfAccountId" VARCHAR(100),
    "lastSyncedAt" TIMESTAMP(3),
    "syncFromDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "money_forward_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "money_forward_connections_operatingCompanyId_idx" ON "money_forward_connections"("operatingCompanyId");

-- AddForeignKey
ALTER TABLE "money_forward_connections" ADD CONSTRAINT "money_forward_connections_operatingCompanyId_fkey" FOREIGN KEY ("operatingCompanyId") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "money_forward_connections" ADD CONSTRAINT "money_forward_connections_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
