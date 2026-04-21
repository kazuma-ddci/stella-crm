-- ============================================
-- SLP顧客種別に「LINEユーザー」「その他」を追加
-- 活動記録の接触履歴ページでこれらも顧客種別タグで分類可能にする
-- ============================================

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'slp_line_users', 'LINEユーザー', 3, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'slp'
ON CONFLICT DO NOTHING;

INSERT INTO "customer_types" ("project_id", "code", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'slp_other', 'その他', 4, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'slp'
ON CONFLICT DO NOTHING;
