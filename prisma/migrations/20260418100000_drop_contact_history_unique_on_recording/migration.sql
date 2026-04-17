-- ============================================
-- SlpZoomRecording.contact_history_id の UNIQUE INDEX を削除
--
-- 前マイグレーション (20260418000000_zoom_recording_absorbs_session_zoom) では
-- Prisma の @unique 削除に対応して CONSTRAINT の DROP IF EXISTS を書いたが、
-- 元の UNIQUE は CREATE UNIQUE INDEX で作成されていたため Constraint ではなく
-- INDEX のみ残存していた。
-- ContactHistory : ZoomRecording = 1:N を正しく実現するため、UNIQUE INDEX を削除する。
-- （非UNIQUEの slp_zoom_recordings_contact_history_id_idx は別途既に存在）
-- ============================================

DROP INDEX IF EXISTS "slp_zoom_recordings_contact_history_id_key";
