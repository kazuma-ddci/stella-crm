-- HojoApplicationSupport: lineFriendId の UNIQUE 制約を外す（同一LINEユーザーで複数レコード可）
DROP INDEX IF EXISTS "hojo_application_supports_lineFriendId_key";

-- vendorIdManual フラグ追加（true=手動設定、false=free1から自動設定）
ALTER TABLE "hojo_application_supports" ADD COLUMN "vendor_id_manual" BOOLEAN NOT NULL DEFAULT false;
