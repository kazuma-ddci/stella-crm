INSERT INTO slp_notification_templates (
  recipient,
  category,
  round_type,
  source,
  trigger,
  form_id,
  label,
  body,
  is_active
)
VALUES
  (
    'customer',
    'briefing',
    'first',
    'proline',
    'regenerated_manual_notice',
    'form16',
    '概要案内 初回 ProLine 後追いZoom URL通知',
    E'{{companyName}} 様\n\n概要案内のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'briefing',
    'continuous',
    'proline',
    'regenerated_manual_notice',
    'form16',
    '概要案内 継続 ProLine 後追いZoom URL通知',
    E'{{companyName}} 様\n\n概要案内のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'briefing',
    'first',
    'manual',
    'regenerated_manual_notice',
    'form16',
    '概要案内 初回 手動 後追いZoom URL通知',
    E'{{companyName}} 様\n\n概要案内のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'briefing',
    'continuous',
    'manual',
    'regenerated_manual_notice',
    'form16',
    '概要案内 継続 手動 後追いZoom URL通知',
    E'{{companyName}} 様\n\n概要案内のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'consultation',
    'first',
    'proline',
    'regenerated_manual_notice',
    'form17',
    '導入希望商談 初回 ProLine 後追いZoom URL通知',
    E'{{companyName}} 様\n\n導入希望商談のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'consultation',
    'continuous',
    'proline',
    'regenerated_manual_notice',
    'form17',
    '導入希望商談 継続 ProLine 後追いZoom URL通知',
    E'{{companyName}} 様\n\n導入希望商談のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'consultation',
    'first',
    'manual',
    'regenerated_manual_notice',
    'form17',
    '導入希望商談 初回 手動 後追いZoom URL通知',
    E'{{companyName}} 様\n\n導入希望商談のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  ),
  (
    'customer',
    'consultation',
    'continuous',
    'manual',
    'regenerated_manual_notice',
    'form17',
    '導入希望商談 継続 手動 後追いZoom URL通知',
    E'{{companyName}} 様\n\n導入希望商談のZoom URLをご案内いたします。\n\n日時: {{scheduledAt}}\n担当: {{staffName}}\nZoom URL: {{zoomUrl}}\n\n当日はこちらのURLからご参加ください。',
    true
  )
ON CONFLICT (recipient, category, round_type, source, trigger) DO NOTHING;
