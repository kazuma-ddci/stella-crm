-- 貸金 顧客進捗の利率/フィー率を保存するシングルトンテーブル
CREATE TABLE "hojo_loan_progress_rate_config" (
  "id" SERIAL PRIMARY KEY,
  "interestRate" DECIMAL(8,6) NOT NULL DEFAULT 0,
  "feeRate" DECIMAL(8,6) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" VARCHAR(255)
);

-- 初期レコード（id=1のシングルトン）
INSERT INTO "hojo_loan_progress_rate_config" ("interestRate", "feeRate", "updatedAt") VALUES (0, 0, NOW());
