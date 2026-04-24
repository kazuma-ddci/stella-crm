import { parseZoomJoinUrl } from "@/lib/zoom/url-parser";

/**
 * V2 ContactHistoryMeeting 向けの外部ID抽出ヘルパー。
 *
 * provider 毎に joinUrl から外部会議IDを取り出し、Webhook 受信時の
 * 突合キー (externalMeetingId) として使えるようにする。
 *
 *   - zoom: /j/{meeting_id} の数値部分
 *   - google_meet / teams / other: 未対応 (将来 Phase D 以降で拡張)
 */
export function extractExternalMeetingIds(
  provider: string,
  joinUrl: string | null | undefined,
): { externalMeetingId: string | null; externalMeetingUuid: string | null } {
  if (!joinUrl) return { externalMeetingId: null, externalMeetingUuid: null };

  if (provider === "zoom") {
    const parsed = parseZoomJoinUrl(joinUrl);
    if (parsed.ok) {
      return { externalMeetingId: parsed.meetingId, externalMeetingUuid: null };
    }
    return { externalMeetingId: null, externalMeetingUuid: null };
  }

  return { externalMeetingId: null, externalMeetingUuid: null };
}
