-- SLP 予約履歴テーブル作成
-- 概要案内・導入希望商談の予約/変更/キャンセル履歴を保存

CREATE TABLE "slp_reservation_history" (
    "id" SERIAL NOT NULL,
    "company_record_id" INTEGER NOT NULL,
    "reservation_type" VARCHAR(20) NOT NULL,
    "action_type" VARCHAR(20) NOT NULL,
    "reservation_id" VARCHAR(100),
    "reserved_at" TIMESTAMP(3),
    "booked_at" TIMESTAMP(3),
    "staff_name" VARCHAR(100),
    "staff_id" INTEGER,
    "form_answers" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_reservation_history_pkey" PRIMARY KEY ("id")
);

-- 企業ごと x 種別 x 新しい順 のクエリ用インデックス
CREATE INDEX "slp_reservation_history_company_record_id_reservation_type_created_at_idx"
    ON "slp_reservation_history"("company_record_id", "reservation_type", "created_at" DESC);

-- 企業レコード削除時にカスケード削除
ALTER TABLE "slp_reservation_history"
    ADD CONSTRAINT "slp_reservation_history_company_record_id_fkey"
    FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
