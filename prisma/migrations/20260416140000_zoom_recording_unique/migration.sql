-- SlpZoomRecording.zoomMeetingId に UNIQUE 制約を追加
-- 複数の recording.completed / transcript.completed Webhookが並行到達した場合の重複作成を防ぐ。

-- 既存の非ユニーク index を削除してから unique index を張る
DROP INDEX IF EXISTS "slp_zoom_recordings_zoom_meeting_id_idx";
CREATE UNIQUE INDEX "slp_zoom_recordings_zoom_meeting_id_key"
  ON "slp_zoom_recordings"("zoom_meeting_id");
