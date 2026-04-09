-- ============================================
-- 本番ベンダーデータ復元SQL
-- ============================================
-- 目的: マイグレーション 20260409100000_hojo_vendor_contract_refactor 適用後に
--       元のキックオフMTGテキスト・契約書URL・備考を新しいスキーマに復元する。
--
-- 実行タイミング: deploy-prod.sh 実行後、1回だけ
-- 実行コマンド:
--   docker compose -f ~/stella-crm/docker-compose.prod.yml exec -T db-prod \
--     psql -U stella_user -d crm_prod < ~/restore-vendor-data.sql
-- ============================================

BEGIN;

-- ============================================
-- 1. キックオフMTG（実日時データのみ）
-- ============================================
-- ID 1 まなびコンサル: 卸="4月9日 (木) 17:30"
UPDATE hojo_vendors SET
  sc_wholesale_kickoff_mtg = '2026-04-09 17:30:00'
WHERE id = 1;

-- ID 2 Untrace: 卸="4月1日 完了"
UPDATE hojo_vendors SET
  sc_wholesale_kickoff_mtg = '2026-04-01 09:00:00',
  sc_wholesale_memo = '完了'
WHERE id = 2;

-- ID 3 ASP: 全部「未予約 / 未案内」
UPDATE hojo_vendors SET
  sc_wholesale_memo          = '未予約',
  consulting_plan_memo       = '未予約',
  grant_application_bpo_memo = '未予約',
  subsidy_consulting_memo    = '未案内'
WHERE id = 3;

-- ID 5 Regista: 卸/コンサル="未予約"
UPDATE hojo_vendors SET
  sc_wholesale_memo    = '未予約',
  consulting_plan_memo = '未予約'
WHERE id = 5;

-- ID 6 ＭＭＹ: 卸="未予約", コンサル/BPO="ライン待ち"+契約書"送付済", 助成金="未案内"
UPDATE hojo_vendors SET
  sc_wholesale_memo          = '未予約',
  consulting_plan_memo       = E'ライン待ち\n契約書: 送付済',
  grant_application_bpo_memo = E'ライン待ち\n契約書: 送付済',
  subsidy_consulting_memo    = '未案内'
WHERE id = 6;

-- ID 7 K-Partner: ＭＭＹコーポレーション連動
UPDATE hojo_vendors SET
  sc_wholesale_memo          = E'未予約\n契約書: ＭＭＹコーポレーションで締結済み',
  consulting_plan_memo       = '契約書: ＭＭＹコーポレーションで送付済',
  grant_application_bpo_memo = '契約書: ＭＭＹコーポレーションで送付済',
  subsidy_consulting_memo    = '未案内'
WHERE id = 7;

-- ID 8 LIMONDE: 卸="4月3日 完了", コンサル="4/10 11:00 概要案内レクチャー", 助成金="未案内"
-- 契約書: コンサル/BPO="再送済／締結待ち"
UPDATE hojo_vendors SET
  sc_wholesale_kickoff_mtg   = '2026-04-03 09:00:00',
  sc_wholesale_memo          = '完了',
  consulting_plan_kickoff_mtg = '2026-04-10 11:00:00',
  consulting_plan_memo       = E'概要案内レクチャー\n契約書: 再送済／締結待ち',
  grant_application_bpo_memo = '契約書: 再送済／締結待ち',
  subsidy_consulting_memo    = '未案内'
WHERE id = 8;

-- ============================================
-- 2. 契約書URL → contract_documents へ
-- ============================================
INSERT INTO hojo_vendor_contract_documents (vendor_id, service_type, type, url, display_order, created_at) VALUES
  -- ID 1 まなび
  (1, 'scWholesale',         'url', 'https://drive.google.com/file/d/1ATcfGzWg27x4UaIwVamyRlgm8Af0hBFY/view?usp=drive_link', 0, NOW()),
  -- ID 2 Untrace
  (2, 'scWholesale',         'url', 'https://drive.google.com/file/d/1yeXVIuTMTIsrErXubTf0m7SwvkDi_H-C/view?usp=drive_link', 0, NOW()),
  -- ID 3 ASP（BPOは2URL分割）
  (3, 'scWholesale',         'url', 'https://drive.google.com/file/d/1aTBSnLhzszOZcIC28axXo8sycHvFCh4K/view?usp=drive_link', 0, NOW()),
  (3, 'consultingPlan',      'url', 'https://drive.google.com/file/d/1agUgSh_83nweaL11spld8eXvQDOGq7I1/view?usp=drive_link', 0, NOW()),
  (3, 'grantApplicationBpo', 'url', 'https://drive.google.com/file/d/1AQatId0iGkPzSh2jxtLldGjgz22kSGrf/view?usp=drive_link', 0, NOW()),
  (3, 'grantApplicationBpo', 'url', 'https://drive.google.com/file/d/1isbD1RKf34uwzbDRTLDfF_6ks4fl2pHw/view?usp=drive_link', 1, NOW()),
  -- ID 5 Regista
  (5, 'scWholesale',         'url', 'https://drive.google.com/file/d/10uVh0oBOzSPKif4C4tDxMY1324rnDIFo/view?usp=drive_link', 0, NOW()),
  (5, 'consultingPlan',      'url', 'https://drive.google.com/file/d/11GViU70A8ekpRF0OFpxAQb8b7joBKoFX/view?usp=drive_link', 0, NOW()),
  -- ID 6 ＭＭＹ
  (6, 'scWholesale',         'url', 'https://drive.google.com/file/d/1UipXQumZ746QaPVcYYzcQVuqtbBu6bKD/view?usp=drive_link', 0, NOW()),
  -- ID 8 LIMONDE
  (8, 'scWholesale',         'url', 'https://drive.google.com/file/d/13ED6ga64CXorWhkroQ6QO39GYOkBNkxO/view?usp=drive_link', 0, NOW());

COMMIT;

-- ============================================
-- 確認用クエリ（実行後の結果確認に）
-- ============================================
-- SELECT id, name,
--   sc_wholesale_kickoff_mtg, sc_wholesale_memo,
--   consulting_plan_kickoff_mtg, consulting_plan_memo,
--   grant_application_bpo_memo, subsidy_consulting_memo, loan_usage_memo
-- FROM hojo_vendors ORDER BY display_order;
--
-- SELECT vendor_id, service_type, type, url FROM hojo_vendor_contract_documents
-- ORDER BY vendor_id, service_type, display_order;
