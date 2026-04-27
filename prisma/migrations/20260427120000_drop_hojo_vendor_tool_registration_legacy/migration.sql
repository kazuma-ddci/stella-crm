-- 旧「ツール登録の有無」構造を削除（複数ツール対応の新構造へ移行）
ALTER TABLE "hojo_vendors" DROP CONSTRAINT IF EXISTS "hojo_vendors_tool_registration_status_id_fkey";
ALTER TABLE "hojo_vendors" DROP COLUMN IF EXISTS "tool_registration_status_id";
ALTER TABLE "hojo_vendors" DROP COLUMN IF EXISTS "tool_registration_memo";
DROP TABLE IF EXISTS "hojo_vendor_tool_registration_statuses";
