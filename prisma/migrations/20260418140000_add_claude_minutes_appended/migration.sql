-- SlpZoomRecording に claude_minutes_appended_at を追加
-- Claude生成議事録を ContactHistory.meetingMinutes に反映済みかの判定用
ALTER TABLE "slp_zoom_recordings"
  ADD COLUMN "claude_minutes_appended_at" TIMESTAMP(3);
