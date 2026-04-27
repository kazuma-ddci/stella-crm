-- ContactHistoryV2 の (sourceType, sourceRefId) でレコード検索する経路が増えたため
-- インデックスを追加する。SLP 商談セッション (slp_meeting_session) との紐付け解決で使われる。
CREATE INDEX IF NOT EXISTS "idx_contact_histories_v2_source"
  ON "contact_histories_v2" ("source_type", "source_ref_id");
