-- 貸金業社アカウントにテーブルUI設定（列固定など）を保存するJSONカラムを追加
ALTER TABLE "hojo_lender_accounts" ADD COLUMN "table_settings" JSONB;

-- 顧客進捗に「償還表発行日」を追加（資金の右側に配置するフィールド）
ALTER TABLE "hojo_loan_progresses" ADD COLUMN "redemption_schedule_issued_at" TIMESTAMP(3);
