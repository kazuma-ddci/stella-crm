-- Drop obsolete Hojo grant customer phase tables.
-- These tables backed the removed "概要案内フェーズ" and "交付申請フェーズ" screens.
DROP TABLE IF EXISTS "hojo_grant_customer_post_applications";
DROP TABLE IF EXISTS "hojo_grant_customer_pre_applications";
