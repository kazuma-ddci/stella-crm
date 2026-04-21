-- Zoom AI プロンプトをプロジェクト別に持てるように project_code カラムを追加。
-- summary (議事録要約) は SLP と HOJO でプロンプトを分け、
-- participants_extract / thankyou_* は projectCode=NULL のまま共通利用。

ALTER TABLE "slp_zoom_ai_prompt_templates" ADD COLUMN "project_code" VARCHAR(20);

-- 既存の unique(template_key) を外し、複合 unique (project_code, template_key) に変更
DROP INDEX IF EXISTS "slp_zoom_ai_prompt_templates_template_key_key";
CREATE UNIQUE INDEX "slp_zoom_ai_prompt_templates_project_code_template_key_key" ON "slp_zoom_ai_prompt_templates" ("project_code", "template_key");

-- 既存の summary 行を SLP 専用に。
UPDATE "slp_zoom_ai_prompt_templates" SET "project_code" = 'slp' WHERE "template_key" = 'summary';

-- HOJO 専用 summary 行を SLP 用をコピーして作成。
INSERT INTO "slp_zoom_ai_prompt_templates" ("template_key", "project_code", "label", "prompt_body", "model", "max_tokens", "updated_by_staff_id", "created_at", "updated_at")
SELECT 'summary', 'hojo', label, prompt_body, model, max_tokens, NULL, NOW(), NOW()
FROM "slp_zoom_ai_prompt_templates"
WHERE "template_key" = 'summary' AND "project_code" = 'slp';
