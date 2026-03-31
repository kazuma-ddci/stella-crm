-- 助成金着金希望日・助成金額を追加
ALTER TABLE "hojo_application_supports" ADD COLUMN "subsidy_desired_date" TIMESTAMP(3);
ALTER TABLE "hojo_application_supports" ADD COLUMN "subsidy_amount" INTEGER;
