-- AlterTable: ExpenseCategory に systemCode カラムを追加
ALTER TABLE "ExpenseCategory" ADD COLUMN "systemCode" VARCHAR(50);

-- CreateIndex: systemCode にユニーク制約（NULLは対象外）
CREATE UNIQUE INDEX "ExpenseCategory_systemCode_key" ON "ExpenseCategory"("systemCode");

-- 既存データにシステムコードを設定（名前ベースのマッチング）
UPDATE "ExpenseCategory" SET "systemCode" = 'stp_revenue_initial'
WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%初期%'
AND "id" = (
  SELECT "id" FROM "ExpenseCategory"
  WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%初期%'
  ORDER BY "id" ASC LIMIT 1
);

UPDATE "ExpenseCategory" SET "systemCode" = 'stp_revenue_monthly'
WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%月額%'
AND "id" = (
  SELECT "id" FROM "ExpenseCategory"
  WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%月額%'
  ORDER BY "id" ASC LIMIT 1
);

UPDATE "ExpenseCategory" SET "systemCode" = 'stp_revenue_performance'
WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%成果%'
AND "id" = (
  SELECT "id" FROM "ExpenseCategory"
  WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'expense' AND "name" LIKE '%成果%'
  ORDER BY "id" ASC LIMIT 1
);

UPDATE "ExpenseCategory" SET "systemCode" = 'stp_expense_agent'
WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'revenue' AND "name" LIKE '%外注%'
AND "id" = (
  SELECT "id" FROM "ExpenseCategory"
  WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'revenue' AND "name" LIKE '%外注%'
  ORDER BY "id" ASC LIMIT 1
);

UPDATE "ExpenseCategory" SET "systemCode" = 'stp_expense_commission'
WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'revenue' AND "name" LIKE '%紹介%'
AND "id" = (
  SELECT "id" FROM "ExpenseCategory"
  WHERE "systemCode" IS NULL AND "deletedAt" IS NULL AND "type" != 'revenue' AND "name" LIKE '%紹介%'
  ORDER BY "id" ASC LIMIT 1
);
