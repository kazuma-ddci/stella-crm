-- Account: subcategoryカラム追加
ALTER TABLE "Account" ADD COLUMN "subcategory" TEXT;

-- ExpenseCategory: projectIdカラム追加 + FK
ALTER TABLE "ExpenseCategory" ADD COLUMN "projectId" INTEGER;

ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 勘定科目マスタデータ投入（経理提供の勘定科目一覧）
-- 既存データがある場合はスキップ（ON CONFLICT DO NOTHING）
-- ============================================

-- 資産（asset）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('1100', '現金', 'asset', '流動資産', 10, true, NOW(), NOW()),
  ('1110', '普通預金', 'asset', '流動資産', 20, true, NOW(), NOW()),
  ('1120', '当座預金', 'asset', '流動資産', 30, true, NOW(), NOW()),
  ('1130', '定期預金', 'asset', '流動資産', 40, true, NOW(), NOW()),
  ('1150', '売掛金', 'asset', '流動資産', 50, true, NOW(), NOW()),
  ('1160', '未収入金', 'asset', '流動資産', 60, true, NOW(), NOW()),
  ('1170', '前払費用', 'asset', '流動資産', 70, true, NOW(), NOW()),
  ('1180', '立替金', 'asset', '流動資産', 80, true, NOW(), NOW()),
  ('1190', '仮払金', 'asset', '流動資産', 90, true, NOW(), NOW()),
  ('1200', '貸付金', 'asset', '流動資産', 100, true, NOW(), NOW()),
  ('1210', '仮払消費税', 'asset', '流動資産', 110, true, NOW(), NOW()),
  ('1300', '建物', 'asset', '有形固定資産', 200, true, NOW(), NOW()),
  ('1310', '建物附属設備', 'asset', '有形固定資産', 210, true, NOW(), NOW()),
  ('1320', '車両運搬具', 'asset', '有形固定資産', 220, true, NOW(), NOW()),
  ('1330', '工具器具備品', 'asset', '有形固定資産', 230, true, NOW(), NOW()),
  ('1340', '土地', 'asset', '有形固定資産', 240, true, NOW(), NOW()),
  ('1400', 'ソフトウェア', 'asset', '無形固定資産', 300, true, NOW(), NOW()),
  ('1500', '敷金・保証金', 'asset', 'その他資産', 400, true, NOW(), NOW()),
  ('1510', '長期前払費用', 'asset', 'その他資産', 410, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 負債（liability）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('2100', '買掛金', 'liability', '流動負債', 500, true, NOW(), NOW()),
  ('2110', '未払金', 'liability', '流動負債', 510, true, NOW(), NOW()),
  ('2120', '未払費用', 'liability', '流動負債', 520, true, NOW(), NOW()),
  ('2130', '前受金', 'liability', '流動負債', 530, true, NOW(), NOW()),
  ('2140', '預り金', 'liability', '流動負債', 540, true, NOW(), NOW()),
  ('2150', '仮受金', 'liability', '流動負債', 550, true, NOW(), NOW()),
  ('2160', '短期借入金', 'liability', '流動負債', 560, true, NOW(), NOW()),
  ('2170', '未払法人税等', 'liability', '流動負債', 570, true, NOW(), NOW()),
  ('2180', '未払消費税等', 'liability', '流動負債', 580, true, NOW(), NOW()),
  ('2190', '仮受消費税', 'liability', '流動負債', 590, true, NOW(), NOW()),
  ('2300', '長期借入金', 'liability', '固定負債', 600, true, NOW(), NOW()),
  ('2310', '役員借入金', 'liability', '固定負債', 610, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 純資産（equity）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('3100', '資本金', 'equity', '株主資本', 700, true, NOW(), NOW()),
  ('3200', '資本準備金', 'equity', '株主資本', 710, true, NOW(), NOW()),
  ('3300', '利益剰余金', 'equity', '株主資本', 720, true, NOW(), NOW()),
  ('3310', '繰越利益剰余金', 'equity', '株主資本', 730, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 売上高（revenue）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('4100', '売上高', 'revenue', '売上高', 800, true, NOW(), NOW()),
  ('4110', '初期費用売上', 'revenue', '売上高', 810, true, NOW(), NOW()),
  ('4120', '月額売上', 'revenue', '売上高', 820, true, NOW(), NOW()),
  ('4130', '成果報酬売上', 'revenue', '売上高', 830, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 売上原価（cost_of_sales）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('5100', '外注費', 'cost_of_sales', '売上原価', 900, true, NOW(), NOW()),
  ('5110', '代理店手数料', 'cost_of_sales', '売上原価', 910, true, NOW(), NOW()),
  ('5120', '仕入高', 'cost_of_sales', '売上原価', 920, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 販売費及び一般管理費（sga）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('6100', '役員報酬', 'sga', '人件費', 1000, true, NOW(), NOW()),
  ('6110', '給与手当', 'sga', '人件費', 1010, true, NOW(), NOW()),
  ('6120', '賞与', 'sga', '人件費', 1020, true, NOW(), NOW()),
  ('6130', '法定福利費', 'sga', '人件費', 1030, true, NOW(), NOW()),
  ('6140', '福利厚生費', 'sga', '人件費', 1040, true, NOW(), NOW()),
  ('6150', '通勤手当', 'sga', '人件費', 1050, true, NOW(), NOW()),
  ('6200', '旅費交通費', 'sga', '経費', 1100, true, NOW(), NOW()),
  ('6210', '通信費', 'sga', '経費', 1110, true, NOW(), NOW()),
  ('6220', '消耗品費', 'sga', '経費', 1120, true, NOW(), NOW()),
  ('6230', '事務用品費', 'sga', '経費', 1130, true, NOW(), NOW()),
  ('6240', '水道光熱費', 'sga', '経費', 1140, true, NOW(), NOW()),
  ('6250', '地代家賃', 'sga', '経費', 1150, true, NOW(), NOW()),
  ('6260', '保険料', 'sga', '経費', 1160, true, NOW(), NOW()),
  ('6270', '租税公課', 'sga', '経費', 1170, true, NOW(), NOW()),
  ('6280', '減価償却費', 'sga', '経費', 1180, true, NOW(), NOW()),
  ('6290', '支払手数料', 'sga', '経費', 1190, true, NOW(), NOW()),
  ('6300', '広告宣伝費', 'sga', '経費', 1200, true, NOW(), NOW()),
  ('6310', '接待交際費', 'sga', '経費', 1210, true, NOW(), NOW()),
  ('6320', '会議費', 'sga', '経費', 1220, true, NOW(), NOW()),
  ('6330', '新聞図書費', 'sga', '経費', 1230, true, NOW(), NOW()),
  ('6340', '研修費', 'sga', '経費', 1240, true, NOW(), NOW()),
  ('6350', '諸会費', 'sga', '経費', 1250, true, NOW(), NOW()),
  ('6360', '業務委託費', 'sga', '経費', 1260, true, NOW(), NOW()),
  ('6370', 'リース料', 'sga', '経費', 1270, true, NOW(), NOW()),
  ('6380', '修繕費', 'sga', '経費', 1280, true, NOW(), NOW()),
  ('6390', '雑費', 'sga', '経費', 1290, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 営業外収益（non_operating_revenue）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('7100', '受取利息', 'non_operating_revenue', '営業外収益', 1300, true, NOW(), NOW()),
  ('7110', '受取配当金', 'non_operating_revenue', '営業外収益', 1310, true, NOW(), NOW()),
  ('7120', '為替差益', 'non_operating_revenue', '営業外収益', 1320, true, NOW(), NOW()),
  ('7130', '雑収入', 'non_operating_revenue', '営業外収益', 1330, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 営業外費用（non_operating_expense）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('7200', '支払利息', 'non_operating_expense', '営業外費用', 1400, true, NOW(), NOW()),
  ('7210', '為替差損', 'non_operating_expense', '営業外費用', 1410, true, NOW(), NOW()),
  ('7220', '雑損失', 'non_operating_expense', '営業外費用', 1420, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 特別利益（extraordinary_income）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('8100', '固定資産売却益', 'extraordinary_income', '特別利益', 1500, true, NOW(), NOW()),
  ('8110', '暗号資産評価益', 'extraordinary_income', '特別利益', 1510, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 特別損失（extraordinary_loss）
INSERT INTO "Account" ("code", "name", "category", "subcategory", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('8200', '固定資産売却損', 'extraordinary_loss', '特別損失', 1600, true, NOW(), NOW()),
  ('8210', '固定資産除却損', 'extraordinary_loss', '特別損失', 1610, true, NOW(), NOW()),
  ('8220', '暗号資産評価損', 'extraordinary_loss', '特別損失', 1620, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
