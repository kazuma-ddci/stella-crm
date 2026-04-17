-- ============================================
-- SLP 通知テンプレートシード（デフォルト文面）
-- 変数プレースホルダー:
--   {{companyName}}   : 事業者名
--   {{scheduledAt}}   : 商談日時（JST, "yyyy/MM/dd HH:mm"）
--   {{staffName}}     : 担当者名
--   {{zoomUrl}}       : Zoom参加URL
--   {{referrerName}}  : 紹介者名（紹介者通知用）
--   {{roundNumber}}   : ラウンド番号
-- ============================================

-- ==============================
-- お客様向け: 概要案内 × 1回目 × プロライン経由
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','briefing','first','proline','confirm','form16','概要案内(1回目・プロライン)予約確定','{{companyName}} 様

概要案内のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

当日お会いできるのを楽しみにしております。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','proline','change','form16','概要案内(1回目・プロライン)予約変更','{{companyName}} 様

概要案内のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

当日お会いできるのを楽しみにしております。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','proline','cancel','form16','概要案内(1回目・プロライン)キャンセル','{{companyName}} 様

概要案内のZoom打ち合わせのキャンセルを承りました。
再度ご希望の場合は、公式LINEよりお申し込みください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','proline','remind_day_before','form16','概要案内(1回目・プロライン)前日リマインド','{{companyName}} 様

明日は概要案内のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}

お忙しいところ恐れ入りますが、どうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','proline','remind_hour_before','form16','概要案内(1回目・プロライン)1時間前リマインド','{{companyName}} 様

まもなく概要案内のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}

お時間になりましたら上記URLよりご参加ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 概要案内 × 1回目 × 手動セット
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','briefing','first','manual','confirm','form16','概要案内(1回目・手動)予約確定','{{companyName}} 様

概要案内のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ こちらの予約はスタッフが直接お取りしたものです。
  変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','manual','change','form16','概要案内(1回目・手動)予約変更','{{companyName}} 様

概要案内のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ さらなる変更・キャンセルは、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','manual','cancel','form16','概要案内(1回目・手動)キャンセル','{{companyName}} 様

概要案内のZoom打ち合わせのキャンセルを承りました。
再度ご希望の場合は、この公式LINEよりご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','manual','remind_day_before','form16','概要案内(1回目・手動)前日リマインド','{{companyName}} 様

明日は概要案内のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','first','manual','remind_hour_before','form16','概要案内(1回目・手動)1時間前リマインド','{{companyName}} 様

まもなく概要案内のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}

お時間になりましたら上記URLよりご参加ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 概要案内 × 2回目以降 × プロライン経由
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','briefing','continuous','proline','confirm','form16','概要案内(2回目以降・プロライン)予約確定','{{companyName}} 様

次回の概要案内のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

引き続きどうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','proline','change','form16','概要案内(2回目以降・プロライン)予約変更','{{companyName}} 様

次回の概要案内のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','proline','cancel','form16','概要案内(2回目以降・プロライン)キャンセル','{{companyName}} 様

次回の概要案内のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','proline','remind_day_before','form16','概要案内(2回目以降・プロライン)前日リマインド','{{companyName}} 様

明日は概要案内のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','proline','remind_hour_before','form16','概要案内(2回目以降・プロライン)1時間前リマインド','{{companyName}} 様

まもなく概要案内のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 概要案内 × 2回目以降 × 手動セット
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','briefing','continuous','manual','confirm','form16','概要案内(2回目以降・手動)予約確定','{{companyName}} 様

次回の概要案内のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','manual','change','form16','概要案内(2回目以降・手動)予約変更','{{companyName}} 様

次回の概要案内のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ さらなる変更・キャンセルは、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','manual','cancel','form16','概要案内(2回目以降・手動)キャンセル','{{companyName}} 様

次回の概要案内のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','manual','remind_day_before','form16','概要案内(2回目以降・手動)前日リマインド','{{companyName}} 様

明日は概要案内のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous','manual','remind_hour_before','form16','概要案内(2回目以降・手動)1時間前リマインド','{{companyName}} 様

まもなく概要案内のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 導入希望商談 × 1回目 × プロライン経由
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','consultation','first','proline','confirm','form17','導入希望商談(1回目・プロライン)予約確定','{{companyName}} 様

導入希望商談のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

当日お会いできるのを楽しみにしております。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','proline','change','form17','導入希望商談(1回目・プロライン)予約変更','{{companyName}} 様

導入希望商談のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','proline','cancel','form17','導入希望商談(1回目・プロライン)キャンセル','{{companyName}} 様

導入希望商談のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','proline','remind_day_before','form17','導入希望商談(1回目・プロライン)前日リマインド','{{companyName}} 様

明日は導入希望商談のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','proline','remind_hour_before','form17','導入希望商談(1回目・プロライン)1時間前リマインド','{{companyName}} 様

まもなく導入希望商談のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 導入希望商談 × 1回目 × 手動セット
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','consultation','first','manual','confirm','form17','導入希望商談(1回目・手動)予約確定','{{companyName}} 様

導入希望商談のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ こちらの予約はスタッフが直接お取りしたものです。
  変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','manual','change','form17','導入希望商談(1回目・手動)予約変更','{{companyName}} 様

導入希望商談のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','manual','cancel','form17','導入希望商談(1回目・手動)キャンセル','{{companyName}} 様

導入希望商談のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','manual','remind_day_before','form17','導入希望商談(1回目・手動)前日リマインド','{{companyName}} 様

明日は導入希望商談のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first','manual','remind_hour_before','form17','導入希望商談(1回目・手動)1時間前リマインド','{{companyName}} 様

まもなく導入希望商談のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 導入希望商談 × 2回目以降 × プロライン経由
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','consultation','continuous','proline','confirm','form17','導入希望商談(2回目以降・プロライン)予約確定','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

引き続きどうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','proline','change','form17','導入希望商談(2回目以降・プロライン)予約変更','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','proline','cancel','form17','導入希望商談(2回目以降・プロライン)キャンセル','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','proline','remind_day_before','form17','導入希望商談(2回目以降・プロライン)前日リマインド','{{companyName}} 様

明日は導入希望商談のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','proline','remind_hour_before','form17','導入希望商談(2回目以降・プロライン)1時間前リマインド','{{companyName}} 様

まもなく導入希望商談のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 導入希望商談 × 2回目以降 × 手動セット
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','consultation','continuous','manual','confirm','form17','導入希望商談(2回目以降・手動)予約確定','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせを以下の日時で予約いたしました。

日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','manual','change','form17','導入希望商談(2回目以降・手動)予約変更','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせの日時が変更されました。

変更後日時: {{scheduledAt}}
担当: {{staffName}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','manual','cancel','form17','導入希望商談(2回目以降・手動)キャンセル','{{companyName}} 様

次回の導入希望商談のZoom打ち合わせのキャンセルを承りました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','manual','remind_day_before','form17','導入希望商談(2回目以降・手動)前日リマインド','{{companyName}} 様

明日は導入希望商談のZoom打ち合わせです。

日時: {{scheduledAt}}
Zoom URL: {{zoomUrl}}

※ 変更・キャンセルのご希望は、この公式LINEへ直接ご連絡ください。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous','manual','remind_hour_before','form17','導入希望商談(2回目以降・手動)1時間前リマインド','{{companyName}} 様

まもなく導入希望商談のZoom打ち合わせが始まります。

Zoom URL: {{zoomUrl}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- お客様向け: 完了後お礼メッセージ（概要案内 1回目 / 2回目以降）
-- Form11 (概要案内) / Form13 (導入希望商談) は自由テキスト型
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('customer','briefing','first',NULL,'complete','form11','概要案内(1回目)完了お礼','{{companyName}} 様

本日はお忙しいところ概要案内にご参加いただき、誠にありがとうございました。
お話を伺った内容をもとに、次回の導入希望商談のご案内をさせていただきます。

引き続きどうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','briefing','continuous',NULL,'complete','form11','概要案内(2回目以降)完了お礼','{{companyName}} 様

本日はお忙しいところ再度の概要案内にご参加いただき、誠にありがとうございました。

引き続きどうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','first',NULL,'complete','form13','導入希望商談(1回目)完了お礼','{{companyName}} 様

本日は導入希望商談にご参加いただき、誠にありがとうございました。
今後の進め方につきまして、近日中に担当よりご連絡差し上げます。

どうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('customer','consultation','continuous',NULL,'complete','form13','導入希望商談(2回目以降)完了お礼','{{companyName}} 様

本日は導入希望商談にご参加いただき、誠にありがとうございました。

引き続きどうぞよろしくお願いいたします。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ==============================
-- 紹介者向け: 概要案内（1回目のみ、Form18統合）
-- 紹介者通知はラウンド1のみ、ソース区別なしで共通
-- ==============================
INSERT INTO "slp_notification_templates" ("recipient","category","round_type","source","trigger","form_id","label","body","is_active","created_at","updated_at") VALUES
('referrer','briefing',NULL,NULL,'confirm','form18','紹介者向け(概要案内)予約確定通知','{{referrerName}} 様

ご紹介いただいた {{companyName}} 様が概要案内の予約を確定されました。

予約日時: {{scheduledAt}}

ご紹介ありがとうございます。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('referrer','briefing',NULL,NULL,'change','form18','紹介者向け(概要案内)予約変更通知','{{referrerName}} 様

ご紹介いただいた {{companyName}} 様の概要案内の日時が変更されました。

変更後日時: {{scheduledAt}}',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('referrer','briefing',NULL,NULL,'cancel','form18','紹介者向け(概要案内)キャンセル通知','{{referrerName}} 様

ご紹介いただいた {{companyName}} 様の概要案内の予約がキャンセルされました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('referrer','briefing',NULL,NULL,'complete','form18','紹介者向け(概要案内)完了通知','{{referrerName}} 様

ご紹介いただいた {{companyName}} 様の概要案内が完了しました。

ご紹介ありがとうございました。',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
