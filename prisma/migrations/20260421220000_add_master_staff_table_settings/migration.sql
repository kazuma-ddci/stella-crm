-- MasterStaff にテーブル列固定などのUI設定用JSONカラムを追加
ALTER TABLE "master_staff" ADD COLUMN "table_settings" JSONB;
