-- CreateTable: invoice_group_receipts
-- 経理側で記録する請求グループへの入金記録（複数行可）
CREATE TABLE "invoice_group_receipts" (
    "id" SERIAL NOT NULL,
    "invoice_group_id" INTEGER NOT NULL,
    "received_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_group_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_group_receipts_invoice_group_id_idx" ON "invoice_group_receipts"("invoice_group_id");

-- CreateIndex
CREATE INDEX "invoice_group_receipts_received_date_idx" ON "invoice_group_receipts"("received_date");

-- AddForeignKey
ALTER TABLE "invoice_group_receipts" ADD CONSTRAINT "invoice_group_receipts_invoice_group_id_fkey" FOREIGN KEY ("invoice_group_id") REFERENCES "InvoiceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_group_receipts" ADD CONSTRAINT "invoice_group_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateTable: payment_group_payments
-- 経理側で記録する支払グループからの支払記録（複数行可）
CREATE TABLE "payment_group_payments" (
    "id" SERIAL NOT NULL,
    "payment_group_id" INTEGER NOT NULL,
    "paid_date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "comment" VARCHAR(500),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_group_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_group_payments_payment_group_id_idx" ON "payment_group_payments"("payment_group_id");

-- CreateIndex
CREATE INDEX "payment_group_payments_paid_date_idx" ON "payment_group_payments"("paid_date");

-- AddForeignKey
ALTER TABLE "payment_group_payments" ADD CONSTRAINT "payment_group_payments_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "PaymentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_group_payments" ADD CONSTRAINT "payment_group_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
