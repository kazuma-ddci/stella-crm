-- Fixed / personal Zoom URLs reuse the same numeric meeting_id for multiple
-- meeting occurrences. Keep meeting_id indexed for lookup, but allow multiple
-- SLP recording rows so each contact history can store its own transcript,
-- recording files, and AI minutes.

DROP INDEX IF EXISTS "slp_zoom_recordings_zoom_meeting_id_key";

CREATE INDEX IF NOT EXISTS "slp_zoom_recordings_zoom_meeting_id_idx"
  ON "slp_zoom_recordings"("zoom_meeting_id");

CREATE INDEX IF NOT EXISTS "slp_zoom_recordings_zoom_meeting_uuid_idx"
  ON "slp_zoom_recordings"("zoom_meeting_uuid");
