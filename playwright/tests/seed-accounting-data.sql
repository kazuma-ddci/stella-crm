-- ============================================================
-- SPEC-ACCOUNTING-001 検証用テストデータ
-- 冪等: 既存データがあれば削除してから再投入
-- 識別用接頭辞: DEMO_ (デモ用データの識別)
-- ============================================================

-- クリーンアップ（依存順序の逆で削除）
DELETE FROM "Reconciliation" WHERE "journalEntryId" IN (SELECT id FROM "JournalEntry" WHERE description LIKE 'DEMO_%');
DELETE FROM "JournalEntryLine" WHERE "journalEntryId" IN (SELECT id FROM "JournalEntry" WHERE description LIKE 'DEMO_%');
DELETE FROM "JournalEntry" WHERE description LIKE 'DEMO_%';
DELETE FROM "BankTransaction" WHERE description LIKE 'DEMO_%';
DELETE FROM "AllocationConfirmation" WHERE "transactionId" IN (SELECT id FROM "Transaction" WHERE note LIKE 'DEMO_%');
DELETE FROM "Transaction" WHERE note LIKE 'DEMO_%';
DELETE FROM "Budget" WHERE memo LIKE 'DEMO_%';
DELETE FROM "AllocationTemplateLine" WHERE "templateId" IN (SELECT id FROM "AllocationTemplate" WHERE name LIKE 'DEMO_%');
DELETE FROM "AllocationTemplate" WHERE name LIKE 'DEMO_%';
DELETE FROM "RecurringTransaction" WHERE name LIKE 'DEMO_%';
DELETE FROM "AutoJournalRule" WHERE "debitAccountId" IN (SELECT id FROM "Account" WHERE code LIKE 'DEMO%');
DELETE FROM "InvoiceTemplate" WHERE name LIKE 'DEMO_%';
DELETE FROM "PaymentMethod" WHERE name LIKE 'DEMO_%';
DELETE FROM "ExpenseCategory" WHERE name LIKE 'DEMO_%';
DELETE FROM "cost_center_project_assignments" WHERE "costCenterId" IN (SELECT id FROM "CostCenter" WHERE name LIKE 'DEMO_%');
DELETE FROM "CostCenter" WHERE name LIKE 'DEMO_%';
DELETE FROM "Counterparty" WHERE name LIKE 'DEMO_%';
DELETE FROM "Account" WHERE code LIKE 'DEMO%';

-- ============================================================
-- 1. 勘定科目マスタ (Account)
-- ============================================================
INSERT INTO "Account" (code, name, category, "displayOrder", "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO1100', '売掛金', 'asset', 10, true, 10, NOW(), NOW()),
  ('DEMO1200', '普通預金', 'asset', 20, true, 10, NOW(), NOW()),
  ('DEMO2100', '買掛金', 'liability', 30, true, 10, NOW(), NOW()),
  ('DEMO2200', '未払金', 'liability', 40, true, 10, NOW(), NOW()),
  ('DEMO4100', '売上高', 'revenue', 50, true, 10, NOW(), NOW()),
  ('DEMO5100', '外注費', 'expense', 60, true, 10, NOW(), NOW()),
  ('DEMO5200', 'サブスク費', 'expense', 70, true, 10, NOW(), NOW()),
  ('DEMO5300', '通信費', 'expense', 80, true, 10, NOW(), NOW()),
  ('DEMO5400', '支払手数料', 'expense', 90, true, 10, NOW(), NOW()),
  ('DEMO5500', '広告宣伝費', 'expense', 100, true, 10, NOW(), NOW());

-- ============================================================
-- 2. 費目マスタ (ExpenseCategory)
-- ============================================================
INSERT INTO "ExpenseCategory" (name, type, "defaultAccountId", "displayOrder", "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO_初期費用', 'revenue', (SELECT id FROM "Account" WHERE code='DEMO4100'), 10, true, 10, NOW(), NOW()),
  ('DEMO_月額費用', 'revenue', (SELECT id FROM "Account" WHERE code='DEMO4100'), 20, true, 10, NOW(), NOW()),
  ('DEMO_スポット売上', 'revenue', (SELECT id FROM "Account" WHERE code='DEMO4100'), 30, true, 10, NOW(), NOW()),
  ('DEMO_外注費', 'expense', (SELECT id FROM "Account" WHERE code='DEMO5100'), 40, true, 10, NOW(), NOW()),
  ('DEMO_サブスク費', 'expense', (SELECT id FROM "Account" WHERE code='DEMO5200'), 50, true, 10, NOW(), NOW()),
  ('DEMO_広告宣伝費', 'expense', (SELECT id FROM "Account" WHERE code='DEMO5500'), 60, true, 10, NOW(), NOW());

-- ============================================================
-- 3. 取引先マスタ (Counterparty)
-- ============================================================
INSERT INTO "Counterparty" (name, "counterpartyType", memo, "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO_株式会社テスト商事', 'customer', 'デモ用顧客企業', true, 10, NOW(), NOW()),
  ('DEMO_有限会社サンプル', 'customer', 'デモ用顧客企業2', true, 10, NOW(), NOW()),
  ('DEMO_フリーランス田中', 'vendor', 'デモ用外注先（個人）', true, 10, NOW(), NOW()),
  ('DEMO_AWS', 'service', 'クラウドサービス', true, 10, NOW(), NOW()),
  ('DEMO_Slack Technologies', 'service', 'チャットツール', true, 10, NOW(), NOW());

-- ============================================================
-- 4. 決済手段マスタ (PaymentMethod)
-- ============================================================
INSERT INTO "PaymentMethod" (name, "methodType", details, "initialBalance", "initialBalanceDate", "balanceAlertThreshold", "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO_三菱UFJ普通', 'bank_account', '{"bankName":"三菱UFJ銀行","branchName":"渋谷支店","accountType":"普通","accountNumber":"1234567","accountHolder":"SRD"}', 5000000, '2026-01-01', 500000, true, 10, NOW(), NOW()),
  ('DEMO_会社用VISA', 'credit_card', '{"brand":"VISA","lastFourDigits":"4321"}', NULL, NULL, NULL, true, 10, NOW(), NOW()),
  ('DEMO_現金（小口）', 'cash', '{}', 100000, '2026-01-01', 10000, true, 10, NOW(), NOW());

-- クレカの引落口座を設定
UPDATE "PaymentMethod" SET "closingDay" = 15, "paymentDay" = 10, "settlementAccountId" = (SELECT id FROM "PaymentMethod" WHERE name = 'DEMO_三菱UFJ普通')
WHERE name = 'DEMO_会社用VISA';

-- ============================================================
-- 5. コストセンター（按分先マスタ）(CostCenter)
-- ============================================================
INSERT INTO "CostCenter" (name, "projectId", "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO_STP事業', 1, true, 10, NOW(), NOW()),
  ('DEMO_SRD事業', 2, true, 10, NOW(), NOW()),
  ('DEMO_社内開発', NULL, true, 10, NOW(), NOW()),
  ('DEMO_管理部門', NULL, true, 10, NOW(), NOW());

-- ============================================================
-- 6. 按分テンプレート (AllocationTemplate + Lines)
-- ============================================================
INSERT INTO "AllocationTemplate" (name, "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  ('DEMO_オフィス家賃按分', true, 10, NOW(), NOW()),
  ('DEMO_外注Aさん按分', true, 10, NOW(), NOW());

-- テンプレート明細: オフィス家賃 STP50% SRD30% 管理20%
INSERT INTO "AllocationTemplateLine" ("templateId", "costCenterId", "allocationRate", label, "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "AllocationTemplate" WHERE name='DEMO_オフィス家賃按分'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 50.00, 'STP事業', NOW(), NOW()),
  ((SELECT id FROM "AllocationTemplate" WHERE name='DEMO_オフィス家賃按分'), (SELECT id FROM "CostCenter" WHERE name='DEMO_SRD事業'), 30.00, 'SRD事業', NOW(), NOW()),
  ((SELECT id FROM "AllocationTemplate" WHERE name='DEMO_オフィス家賃按分'), (SELECT id FROM "CostCenter" WHERE name='DEMO_管理部門'), 20.00, '管理部門', NOW(), NOW());

-- テンプレート明細: 外注Aさん STP70% 社内開発30%
INSERT INTO "AllocationTemplateLine" ("templateId", "costCenterId", "allocationRate", label, "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "AllocationTemplate" WHERE name='DEMO_外注Aさん按分'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 70.00, 'STP事業', NOW(), NOW()),
  ((SELECT id FROM "AllocationTemplate" WHERE name='DEMO_外注Aさん按分'), (SELECT id FROM "CostCenter" WHERE name='DEMO_社内開発'), 30.00, '社内開発', NOW(), NOW());

-- ============================================================
-- 7. 自動仕訳ルール (AutoJournalRule)
-- ============================================================
INSERT INTO "AutoJournalRule" ("counterpartyId", "transactionType", "expenseCategoryId", "debitAccountId", "creditAccountId", priority, "isActive", "createdBy", "createdAt", "updatedAt")
VALUES
  -- 売上 → 借方:売掛金、貸方:売上高
  (NULL, 'revenue', NULL, (SELECT id FROM "Account" WHERE code='DEMO1100'), (SELECT id FROM "Account" WHERE code='DEMO4100'), 100, true, 10, NOW(), NOW()),
  -- 外注費 → 借方:外注費、貸方:買掛金
  (NULL, 'expense', (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_外注費'), (SELECT id FROM "Account" WHERE code='DEMO5100'), (SELECT id FROM "Account" WHERE code='DEMO2100'), 50, true, 10, NOW(), NOW()),
  -- サブスク費 → 借方:サブスク費、貸方:未払金
  (NULL, 'expense', (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_サブスク費'), (SELECT id FROM "Account" WHERE code='DEMO5200'), (SELECT id FROM "Account" WHERE code='DEMO2200'), 60, true, 10, NOW(), NOW());

-- ============================================================
-- 8. 定期取引 (RecurringTransaction)
-- ============================================================
INSERT INTO "RecurringTransaction" ("counterpartyId", "expenseCategoryId", "costCenterId", type, name, amount, "taxAmount", "taxRate", "amountType", frequency, "executionDay", "startDate", "isActive", note, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_AWS'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_サブスク費'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 'expense', 'DEMO_AWS利用料', 50000, 5000, 10, 'variable', 'monthly', 1, '2026-01-01', true, 'DEMO_毎月変動するクラウド利用料', 10, NOW(), NOW()),
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_Slack Technologies'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_サブスク費'), (SELECT id FROM "CostCenter" WHERE name='DEMO_社内開発'), 'expense', 'DEMO_Slack月額', 3000, 300, 10, 'fixed', 'monthly', 15, '2026-01-01', true, 'DEMO_固定額のサブスク費', 10, NOW(), NOW());

-- ============================================================
-- 9. 取引 (Transaction) - デモ用サンプル
-- ============================================================

-- 売上取引: 株式会社テスト商事への初期費用（確認済み）
INSERT INTO "Transaction" ("counterpartyId", "expenseCategoryId", "costCenterId", "projectId", type, amount, "taxAmount", "taxRate", "taxType", "periodFrom", "periodTo", status, note, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_株式会社テスト商事'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_初期費用'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 1, 'revenue', 500000, 50000, 10, 'tax_excluded', '2026-02-01', '2026-02-01', 'confirmed', 'DEMO_STP初期費用（テスト商事）', 10, NOW(), NOW());

-- 売上取引: 株式会社テスト商事への月額費用（確認済み）
INSERT INTO "Transaction" ("counterpartyId", "expenseCategoryId", "costCenterId", "projectId", type, amount, "taxAmount", "taxRate", "taxType", "periodFrom", "periodTo", status, note, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_株式会社テスト商事'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_月額費用'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 1, 'revenue', 300000, 30000, 10, 'tax_excluded', '2026-02-01', '2026-02-28', 'confirmed', 'DEMO_STP月額費用2月分（テスト商事）', 10, NOW(), NOW());

-- 売上取引: 有限会社サンプルへの月額費用（未確認）
INSERT INTO "Transaction" ("counterpartyId", "expenseCategoryId", "costCenterId", "projectId", type, amount, "taxAmount", "taxRate", "taxType", "periodFrom", "periodTo", status, note, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_有限会社サンプル'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_月額費用'), (SELECT id FROM "CostCenter" WHERE name='DEMO_SRD事業'), 2, 'revenue', 200000, 20000, 10, 'tax_excluded', '2026-02-01', '2026-02-28', 'unconfirmed', 'DEMO_SRD月額費用2月分（サンプル社）', 10, NOW(), NOW());

-- 経費取引: 外注費（按分テンプレート使用、源泉徴収あり）
INSERT INTO "Transaction" ("counterpartyId", "expenseCategoryId", "allocationTemplateId", "projectId", type, amount, "taxAmount", "taxRate", "taxType", "periodFrom", "periodTo", "paymentDueDate", "paymentMethodId", status, note, "isWithholdingTarget", "withholdingTaxRate", "withholdingTaxAmount", "netPaymentAmount", "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_フリーランス田中'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_外注費'), (SELECT id FROM "AllocationTemplate" WHERE name='DEMO_外注Aさん按分'), 1, 'expense', 400000, 40000, 10, 'tax_excluded', '2026-02-01', '2026-02-28', '2026-03-31', (SELECT id FROM "PaymentMethod" WHERE name='DEMO_三菱UFJ普通'), 'confirmed', 'DEMO_外注費2月分（田中さん・按分あり・源泉あり）', true, 10.21, 40840, 399160, 10, NOW(), NOW());

-- 経費取引: AWS利用料（直接プロジェクト指定）
INSERT INTO "Transaction" ("counterpartyId", "expenseCategoryId", "costCenterId", "projectId", type, amount, "taxAmount", "taxRate", "taxType", "periodFrom", "periodTo", "paymentDueDate", "paymentMethodId", status, note, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "Counterparty" WHERE name='DEMO_AWS'), (SELECT id FROM "ExpenseCategory" WHERE name='DEMO_サブスク費'), (SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), 1, 'expense', 55000, 5500, 10, 'tax_excluded', '2026-02-01', '2026-02-28', '2026-03-15', (SELECT id FROM "PaymentMethod" WHERE name='DEMO_会社用VISA'), 'unconfirmed', 'DEMO_AWS利用料2月分', 10, NOW(), NOW());

-- ============================================================
-- 10. 入出金 (BankTransaction)
-- ============================================================
INSERT INTO "BankTransaction" ("transactionDate", direction, "paymentMethodId", "counterpartyId", amount, description, source, "createdBy", "createdAt", "updatedAt")
VALUES
  ('2026-02-15', 'incoming', (SELECT id FROM "PaymentMethod" WHERE name='DEMO_三菱UFJ普通'), (SELECT id FROM "Counterparty" WHERE name='DEMO_株式会社テスト商事'), 550000, 'DEMO_テスト商事初期費用入金', 'manual', 10, NOW(), NOW()),
  ('2026-02-20', 'incoming', (SELECT id FROM "PaymentMethod" WHERE name='DEMO_三菱UFJ普通'), (SELECT id FROM "Counterparty" WHERE name='DEMO_株式会社テスト商事'), 330000, 'DEMO_テスト商事月額入金', 'manual', 10, NOW(), NOW()),
  ('2026-02-25', 'outgoing', (SELECT id FROM "PaymentMethod" WHERE name='DEMO_三菱UFJ普通'), (SELECT id FROM "Counterparty" WHERE name='DEMO_フリーランス田中'), 399160, 'DEMO_田中さん外注費支払', 'manual', 10, NOW(), NOW());

-- ============================================================
-- 11. 仕訳 (JournalEntry + Lines)
-- ============================================================

-- 仕訳1: 初期費用の売上計上
INSERT INTO "JournalEntry" ("journalDate", description, "isAutoGenerated", status, "createdBy", "createdAt", "updatedAt")
VALUES ('2026-02-01', 'DEMO_テスト商事初期費用 売上計上', true, 'confirmed', 10, NOW(), NOW());

INSERT INTO "JournalEntryLine" ("journalEntryId", side, "accountId", amount, description, "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "JournalEntry" WHERE description='DEMO_テスト商事初期費用 売上計上'), 'debit', (SELECT id FROM "Account" WHERE code='DEMO1100'), 550000, '売掛金', NOW(), NOW()),
  ((SELECT id FROM "JournalEntry" WHERE description='DEMO_テスト商事初期費用 売上計上'), 'credit', (SELECT id FROM "Account" WHERE code='DEMO4100'), 550000, '売上高', NOW(), NOW());

-- 仕訳2: 外注費計上
INSERT INTO "JournalEntry" ("journalDate", description, "isAutoGenerated", status, "createdBy", "createdAt", "updatedAt")
VALUES ('2026-02-28', 'DEMO_田中外注費2月分 経費計上', true, 'draft', 10, NOW(), NOW());

INSERT INTO "JournalEntryLine" ("journalEntryId", side, "accountId", amount, description, "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "JournalEntry" WHERE description='DEMO_田中外注費2月分 経費計上'), 'debit', (SELECT id FROM "Account" WHERE code='DEMO5100'), 440000, '外注費', NOW(), NOW()),
  ((SELECT id FROM "JournalEntry" WHERE description='DEMO_田中外注費2月分 経費計上'), 'credit', (SELECT id FROM "Account" WHERE code='DEMO2100'), 440000, '買掛金', NOW(), NOW());

-- ============================================================
-- 12. 予算 (Budget) - 2026年2月分
-- ============================================================
INSERT INTO "Budget" ("costCenterId", "accountId", "categoryLabel", "targetMonth", "budgetAmount", memo, "createdBy", "createdAt", "updatedAt")
VALUES
  ((SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), (SELECT id FROM "Account" WHERE code='DEMO4100'), '売上高', '2026-02-01', 1000000, 'DEMO_STP売上予算2月', 10, NOW(), NOW()),
  ((SELECT id FROM "CostCenter" WHERE name='DEMO_STP事業'), (SELECT id FROM "Account" WHERE code='DEMO5100'), '外注費', '2026-02-01', 500000, 'DEMO_STP外注費予算2月', 10, NOW(), NOW()),
  ((SELECT id FROM "CostCenter" WHERE name='DEMO_SRD事業'), (SELECT id FROM "Account" WHERE code='DEMO4100'), '売上高', '2026-02-01', 800000, 'DEMO_SRD売上予算2月', 10, NOW(), NOW()),
  (NULL, (SELECT id FROM "Account" WHERE code='DEMO4100'), '売上高（全社）', '2026-02-01', 2000000, 'DEMO_全社売上予算2月', 10, NOW(), NOW());

-- ============================================================
-- 13. 請求書テンプレート (InvoiceTemplate)
-- ============================================================
INSERT INTO "InvoiceTemplate" ("operatingCompanyId", name, "templateType", "emailSubjectTemplate", "emailBodyTemplate", "isDefault", "createdBy", "createdAt", "updatedAt")
VALUES
  (1, 'DEMO_請求書送付テンプレート', 'sending', '【{{法人名}}】{{年月}}分 御請求書送付のご案内', '{{取引先名}} {{担当者名}}様\n\nいつもお世話になっております。\n{{法人名}}です。\n\n{{年月}}分の御請求書を添付いたします。\n\n合計金額：{{合計金額}}\nお支払期限：{{支払期限}}\n\nご確認のほど、よろしくお願いいたします。', true, 10, NOW(), NOW()),
  (1, 'DEMO_発行依頼テンプレート', 'request', '【{{法人名}}】請求書発行のお願い（{{年月}}分）', '{{取引先名}}様\n\nいつもお世話になっております。\n{{法人名}}です。\n\n{{年月}}分の請求書発行をお願いいたします。\nPDFファイル名：{{指定PDF名}}\n\nよろしくお願いいたします。', false, 10, NOW(), NOW());

-- 確認用: 投入データ件数
SELECT 'Account' as table_name, count(*) as demo_count FROM "Account" WHERE code LIKE 'DEMO%'
UNION ALL SELECT 'ExpenseCategory', count(*) FROM "ExpenseCategory" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'Counterparty', count(*) FROM "Counterparty" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'PaymentMethod', count(*) FROM "PaymentMethod" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'CostCenter', count(*) FROM "CostCenter" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'AllocationTemplate', count(*) FROM "AllocationTemplate" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'AllocationTemplateLine', count(*) FROM "AllocationTemplateLine" WHERE "templateId" IN (SELECT id FROM "AllocationTemplate" WHERE name LIKE 'DEMO_%')
UNION ALL SELECT 'AutoJournalRule', count(*) FROM "AutoJournalRule" WHERE "debitAccountId" IN (SELECT id FROM "Account" WHERE code LIKE 'DEMO%')
UNION ALL SELECT 'RecurringTransaction', count(*) FROM "RecurringTransaction" WHERE name LIKE 'DEMO_%'
UNION ALL SELECT 'Transaction', count(*) FROM "Transaction" WHERE note LIKE 'DEMO_%'
UNION ALL SELECT 'BankTransaction', count(*) FROM "BankTransaction" WHERE description LIKE 'DEMO_%'
UNION ALL SELECT 'JournalEntry', count(*) FROM "JournalEntry" WHERE description LIKE 'DEMO_%'
UNION ALL SELECT 'Budget', count(*) FROM "Budget" WHERE memo LIKE 'DEMO_%'
UNION ALL SELECT 'InvoiceTemplate', count(*) FROM "InvoiceTemplate" WHERE name LIKE 'DEMO_%'
ORDER BY table_name;
