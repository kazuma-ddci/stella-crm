-- AlterTable: login_uid を削除、email/password にデフォルト値を設定
ALTER TABLE "hojo_proline_accounts" DROP COLUMN "login_uid";
ALTER TABLE "hojo_proline_accounts" ALTER COLUMN "email" SET DEFAULT '';
ALTER TABLE "hojo_proline_accounts" ALTER COLUMN "password" SET DEFAULT '';

-- 4つの公式LINEアカウントを初期データとして挿入
INSERT INTO "hojo_proline_accounts" ("line_type", "label", "email", "password", "is_active", "created_at", "updated_at")
VALUES
  ('security-cloud', 'セキュリティクラウドサポート', '', '', true, NOW(), NOW()),
  ('shinsei-support', '申請サポートセンター', '', '', true, NOW(), NOW()),
  ('alkes', 'ALKES', '', '', true, NOW(), NOW()),
  ('josei-support', '助成金申請サポート', '', '', true, NOW(), NOW())
ON CONFLICT ("line_type") DO NOTHING;
