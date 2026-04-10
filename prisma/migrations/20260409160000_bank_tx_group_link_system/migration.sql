-- 銀行入出金履歴 ↔ 請求/支払グループ の分割紐付けシステムへの移行
--
-- 変更内容:
-- 1. BankTransaction に linkCompleted (経理が紐付け完了を手動確定するフラグ) を追加
-- 2. InvoiceGroupReceipt / PaymentGroupPayment に bankTransactionLinkId を追加（銀行履歴由来の記録判別）
-- 3. 既存の BankTransaction.invoiceGroupId / paymentGroupId (1:1) のデータを BankTransactionGroupLink (M:N) に移行
-- 4. 同時に自動生成される InvoiceGroupReceipt / PaymentGroupPayment も生成
-- 5. BankTransaction.invoiceGroupId / paymentGroupId カラムを削除

-- ============================================
-- 1. BankTransaction.link_completed 追加
-- ============================================
ALTER TABLE "BankTransaction"
  ADD COLUMN "link_completed" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 2. InvoiceGroupReceipt.bank_transaction_link_id 追加
-- ============================================
ALTER TABLE "invoice_group_receipts"
  ADD COLUMN "bank_transaction_link_id" INTEGER;

CREATE UNIQUE INDEX "invoice_group_receipts_bank_transaction_link_id_key"
  ON "invoice_group_receipts"("bank_transaction_link_id");

-- ============================================
-- 3. PaymentGroupPayment.bank_transaction_link_id 追加
-- ============================================
ALTER TABLE "payment_group_payments"
  ADD COLUMN "bank_transaction_link_id" INTEGER;

CREATE UNIQUE INDEX "payment_group_payments_bank_transaction_link_id_key"
  ON "payment_group_payments"("bank_transaction_link_id");

-- ============================================
-- 4. 既存 1:1 紐付けデータを BankTransactionGroupLink に移行
-- ============================================
-- 既存で BankTransaction.invoiceGroupId が設定されているデータを M:N テーブルに変換
-- 同時に自動的に InvoiceGroupReceipt も生成する (銀行履歴 = 自動生成された入金記録)

-- 4-1. 請求グループ側
DO $$
DECLARE
  tx RECORD;
  new_link_id INTEGER;
BEGIN
  FOR tx IN
    SELECT id, "invoiceGroupId", amount, "transactionDate", "createdBy"
    FROM "BankTransaction"
    WHERE "invoiceGroupId" IS NOT NULL
      AND "deletedAt" IS NULL
  LOOP
    -- リンクを作成
    INSERT INTO "BankTransactionGroupLink" (
      "bankTransactionId", "invoiceGroupId", "paymentGroupId",
      amount, note, "createdBy", "createdAt"
    )
    VALUES (
      tx.id, tx."invoiceGroupId", NULL,
      tx.amount, '旧システムから自動移行', tx."createdBy", NOW()
    )
    RETURNING id INTO new_link_id;

    -- 対応する InvoiceGroupReceipt を作成 (まだ存在しない場合のみ)
    IF NOT EXISTS (
      SELECT 1 FROM invoice_group_receipts
      WHERE bank_transaction_link_id = new_link_id
    ) THEN
      INSERT INTO invoice_group_receipts (
        invoice_group_id, received_date, amount, comment,
        created_by_id, bank_transaction_link_id,
        created_at, updated_at
      )
      VALUES (
        tx."invoiceGroupId", tx."transactionDate", tx.amount,
        '銀行履歴から自動移行',
        tx."createdBy", new_link_id,
        NOW(), NOW()
      );
    END IF;
  END LOOP;
END $$;

-- 4-2. 支払グループ側
DO $$
DECLARE
  tx RECORD;
  new_link_id INTEGER;
BEGIN
  FOR tx IN
    SELECT id, "paymentGroupId", amount, "transactionDate", "createdBy"
    FROM "BankTransaction"
    WHERE "paymentGroupId" IS NOT NULL
      AND "deletedAt" IS NULL
  LOOP
    INSERT INTO "BankTransactionGroupLink" (
      "bankTransactionId", "invoiceGroupId", "paymentGroupId",
      amount, note, "createdBy", "createdAt"
    )
    VALUES (
      tx.id, NULL, tx."paymentGroupId",
      tx.amount, '旧システムから自動移行', tx."createdBy", NOW()
    )
    RETURNING id INTO new_link_id;

    IF NOT EXISTS (
      SELECT 1 FROM payment_group_payments
      WHERE bank_transaction_link_id = new_link_id
    ) THEN
      INSERT INTO payment_group_payments (
        payment_group_id, paid_date, amount, comment,
        created_by_id, bank_transaction_link_id,
        created_at, updated_at
      )
      VALUES (
        tx."paymentGroupId", tx."transactionDate", tx.amount,
        '銀行履歴から自動移行',
        tx."createdBy", new_link_id,
        NOW(), NOW()
      );
    END IF;
  END LOOP;
END $$;

-- 4-3. 移行済みデータは link_completed = true としておく（経理が既に確認済みとみなす）
UPDATE "BankTransaction"
SET "link_completed" = true
WHERE id IN (
  SELECT DISTINCT "bankTransactionId" FROM "BankTransactionGroupLink"
);

-- ============================================
-- 5. 旧カラム削除
-- ============================================
-- 外部キー制約を先に落とす
ALTER TABLE "BankTransaction" DROP CONSTRAINT IF EXISTS "BankTransaction_invoiceGroupId_fkey";
ALTER TABLE "BankTransaction" DROP CONSTRAINT IF EXISTS "BankTransaction_paymentGroupId_fkey";

ALTER TABLE "BankTransaction" DROP COLUMN IF EXISTS "invoiceGroupId";
ALTER TABLE "BankTransaction" DROP COLUMN IF EXISTS "paymentGroupId";

-- ============================================
-- 6. InvoiceGroupReceipt / PaymentGroupPayment FK制約追加
-- ============================================
ALTER TABLE "invoice_group_receipts"
  ADD CONSTRAINT "invoice_group_receipts_bank_transaction_link_id_fkey"
  FOREIGN KEY ("bank_transaction_link_id")
  REFERENCES "BankTransactionGroupLink"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_group_payments"
  ADD CONSTRAINT "payment_group_payments_bank_transaction_link_id_fkey"
  FOREIGN KEY ("bank_transaction_link_id")
  REFERENCES "BankTransactionGroupLink"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
