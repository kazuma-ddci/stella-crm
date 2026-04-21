-- 資料種別ごとの生成中フラグ（並列3件対応）。
-- 旧 pdf_generation_running_at / pdf_generation_running_doc_type は廃止。

ALTER TABLE "hojo_application_supports" ADD COLUMN "training_report_running_at" TIMESTAMP(3);
ALTER TABLE "hojo_application_supports" ADD COLUMN "support_application_running_at" TIMESTAMP(3);
ALTER TABLE "hojo_application_supports" ADD COLUMN "business_plan_running_at" TIMESTAMP(3);

ALTER TABLE "hojo_application_supports" DROP COLUMN IF EXISTS "pdf_generation_running_at";
ALTER TABLE "hojo_application_supports" DROP COLUMN IF EXISTS "pdf_generation_running_doc_type";
