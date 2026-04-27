-- 「融資稟議確認中」を「審査中」へリネーム
UPDATE "hojo_loan_progress_statuses"
SET "name" = '審査中', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = '融資稟議確認中';

-- 「審査中」の上に表示する「申込書類収集中」を追加（displayOrder=0で先頭に配置）
INSERT INTO "hojo_loan_progress_statuses" ("name", "displayOrder", "updatedAt")
SELECT '申込書類収集中', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "hojo_loan_progress_statuses" WHERE "name" = '申込書類収集中'
);
