-- プロライン予約フォーム(form3-2〜4)で入力された生テキストを保存するカラム。
-- 「5000万円」「約50人」等、数値変換できない回答もそのまま残し、企業詳細画面で
-- 数値入力欄の上にサジェスト表示してスタッフが手動で数値化する運用。
ALTER TABLE "slp_company_records" ADD COLUMN "annual_labor_cost_executive_form_answer" VARCHAR(500);
ALTER TABLE "slp_company_records" ADD COLUMN "annual_labor_cost_employee_form_answer"  VARCHAR(500);
ALTER TABLE "slp_company_records" ADD COLUMN "employee_count_form_answer"              VARCHAR(500);
