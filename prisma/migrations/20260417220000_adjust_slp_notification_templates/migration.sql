-- ============================================
-- 通知テンプレート調整
-- - 顧客向け「完了お礼」(form11/form13) テンプレート削除
--   → お礼メッセージはスタッフが毎回手動入力するため不要
-- - 紹介者向け「不参加通知」(no_show) テンプレート追加
--   → 飛び時に briefing 1回目のみ紹介者に通知
-- ============================================

-- 顧客向け完了テンプレートを削除（4件）
DELETE FROM "slp_notification_templates"
WHERE "recipient" = 'customer'
  AND "trigger" = 'complete'
  AND "form_id" IN ('form11', 'form13');

-- 紹介者向け不参加通知テンプレート追加（1件、briefing 1回目のみ使用）
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('referrer','briefing',NULL,NULL,'no_show','form18','紹介者向け(概要案内)不参加通知','{{referrerName}} 様

ご紹介いただいた {{companyName}} 様が、本日の概要案内に参加されませんでした。

状況の確認と必要に応じたフォローをお願いいたします。

どうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
