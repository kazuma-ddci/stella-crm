-- 有効な（未削除・未統合の）Counterpartyに対して companyId のユニーク制約を追加
-- companyId IS NULL（その他取引先）は対象外
CREATE UNIQUE INDEX "Counterparty_companyId_active_unique"
  ON "Counterparty" ("companyId")
  WHERE "companyId" IS NOT NULL
    AND "deletedAt" IS NULL
    AND "mergedIntoId" IS NULL;
