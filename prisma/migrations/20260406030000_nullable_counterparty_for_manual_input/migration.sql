-- 手入力取引先対応: PaymentGroup.counterpartyIdのみnullable化
-- プロジェクト側が手入力した場合、PGのcounterpartyId=nullでcustomCounterpartyNameに文字列を保持
-- 経理が承認時にマスタ紐付け → Transactionは承認後に作成するためNOT NULLのまま

ALTER TABLE "PaymentGroup" ALTER COLUMN "counterpartyId" DROP NOT NULL;

-- Transaction.counterpartyIdを一度nullable化してしまった場合の復元
-- (既存データはすべてNOT NULLなので安全)
ALTER TABLE "Transaction" ALTER COLUMN "counterpartyId" SET NOT NULL;
