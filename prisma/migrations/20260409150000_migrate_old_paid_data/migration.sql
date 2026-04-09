-- 古いpaidデータの移行
-- actualPaymentDate が入っていて、新しい入金/支払履歴テーブルが空のものに対して
-- 1行だけレコードを自動作成する。これにより新UIの「入金完了／支払完了」タブで正しく表示される。
--
-- 作成者は master_staff の id=1 を暫定で使用（最も古いスタッフ）

-- 1. InvoiceGroup → InvoiceGroupReceipt
INSERT INTO invoice_group_receipts (
  invoice_group_id,
  received_date,
  amount,
  comment,
  created_by_id,
  created_at,
  updated_at
)
SELECT
  ig.id,
  ig."actualPaymentDate",
  COALESCE(ig."totalAmount", 0),
  'データ移行（旧ステータス paid から自動生成）',
  COALESCE((SELECT id FROM master_staff ORDER BY id ASC LIMIT 1), 1),
  NOW(),
  NOW()
FROM "InvoiceGroup" ig
WHERE ig."actualPaymentDate" IS NOT NULL
  AND ig."deletedAt" IS NULL
  AND ig."totalAmount" IS NOT NULL
  AND ig."totalAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM invoice_group_receipts r WHERE r.invoice_group_id = ig.id
  );

-- 2. PaymentGroup → PaymentGroupPayment
INSERT INTO payment_group_payments (
  payment_group_id,
  paid_date,
  amount,
  comment,
  created_by_id,
  created_at,
  updated_at
)
SELECT
  pg.id,
  pg."actualPaymentDate",
  COALESCE(pg."totalAmount", 0),
  'データ移行（旧ステータス paid から自動生成）',
  COALESCE((SELECT id FROM master_staff ORDER BY id ASC LIMIT 1), 1),
  NOW(),
  NOW()
FROM "PaymentGroup" pg
WHERE pg."actualPaymentDate" IS NOT NULL
  AND pg."deletedAt" IS NULL
  AND pg."totalAmount" IS NOT NULL
  AND pg."totalAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM payment_group_payments p WHERE p.payment_group_id = pg.id
  );
