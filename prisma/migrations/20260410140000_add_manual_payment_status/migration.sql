-- 経理が手動で切り替える「入金完了 / 一部入金 / 未入金」フラグを追加
-- 振込手数料等で記録合計と請求金額が一致しないため、自動判定ではなく手動管理

ALTER TABLE "InvoiceGroup"
  ADD COLUMN "manual_payment_status" TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE "PaymentGroup"
  ADD COLUMN "manual_payment_status" TEXT NOT NULL DEFAULT 'unpaid';
