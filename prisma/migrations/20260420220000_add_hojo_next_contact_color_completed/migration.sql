-- 補助金プロジェクト UX 改善: 次の連絡日フィールド / プランマスタの色 / 契約・登録マスタの完了フラグ

-- AlterTable: HojoVendor に3つの「次の連絡日」フィールド追加
ALTER TABLE "hojo_vendors"
  ADD COLUMN "next_contact_date" TIMESTAMP(3),
  ADD COLUMN "next_contact_date_wholesale" TIMESTAMP(3),
  ADD COLUMN "next_contact_date_consulting" TIMESTAMP(3);

-- AlterTable: HojoLineFriendJoseiSupport に次の連絡日追加
ALTER TABLE "hojo_line_friends_josei_support"
  ADD COLUMN "next_contact_date" TIMESTAMP(3);

-- AlterTable: 卸プランマスタに色追加
ALTER TABLE "hojo_vendor_sc_wholesale_statuses"
  ADD COLUMN "color" VARCHAR(20) NOT NULL DEFAULT 'gray';

-- AlterTable: コンサルプランマスタに色追加
ALTER TABLE "hojo_vendor_consulting_plan_statuses"
  ADD COLUMN "color" VARCHAR(20) NOT NULL DEFAULT 'gray';

-- AlterTable: 契約状況マスタに完了フラグ追加
ALTER TABLE "hojo_vendor_contract_statuses"
  ADD COLUMN "is_completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ベンダー登録状況マスタに完了フラグ追加
ALTER TABLE "hojo_vendor_registration_statuses"
  ADD COLUMN "is_completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ツール登録状況マスタに完了フラグ追加
ALTER TABLE "hojo_vendor_tool_registration_statuses"
  ADD COLUMN "is_completed" BOOLEAN NOT NULL DEFAULT false;

-- 既存データの完了フラグ初期化（「締結済み」「登録済み」という名前のレコードは完了とみなす）
UPDATE "hojo_vendor_contract_statuses" SET "is_completed" = true WHERE "name" = '締結済み';
UPDATE "hojo_vendor_registration_statuses" SET "is_completed" = true WHERE "name" = '登録済み';
UPDATE "hojo_vendor_tool_registration_statuses" SET "is_completed" = true WHERE "name" = '登録済み';
