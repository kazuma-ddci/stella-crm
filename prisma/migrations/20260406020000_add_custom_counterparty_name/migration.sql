-- PaymentGroup: 手入力取引先名（経理がマスタ紐付けするまでの仮値）
ALTER TABLE "PaymentGroup" ADD COLUMN "customCounterpartyName" TEXT;
