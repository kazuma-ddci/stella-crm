-- SlpZoomRecording に追加フィールドを実装
-- - チャットログ（CHAT 形式の録画ファイル）
-- - 参加者情報（名前・メール・入退室時刻・参加時間）
-- - AI Companion の next_steps（アクションアイテム）

ALTER TABLE "slp_zoom_recordings"
  ADD COLUMN "summary_next_steps" TEXT,
  ADD COLUMN "chat_log_path" VARCHAR(1000),
  ADD COLUMN "chat_log_text" TEXT,
  ADD COLUMN "chat_fetched_at" TIMESTAMP(3),
  ADD COLUMN "participants_json" TEXT,
  ADD COLUMN "participants_fetched_at" TIMESTAMP(3);
