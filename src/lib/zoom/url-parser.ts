/**
 * Zoom URL から meeting_id を抽出するパーサー
 *
 * 対応形式:
 *   https://zoom.us/j/{MEETING_ID}?pwd=...
 *   https://{subdomain}.zoom.us/j/{MEETING_ID}?pwd=...
 *   https://zoom.us/j/{MEETING_ID}
 *
 * 非対応:
 *   - 録画共有URL (zoom.us/rec/share/...)
 *   - ミーティングUUID形式
 */

export type ParsedZoomUrl = {
  ok: true;
  meetingId: string; // 数字のみ（BigIntに変換可能）
  cleanUrl: string; // パスワード付きの正規化URL
} | {
  ok: false;
  error: string;
};

export function parseZoomJoinUrl(rawUrl: string): ParsedZoomUrl {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "URLを入力してください" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "URLの形式が不正です" };
  }

  // zoom.us ドメインチェック（カスタムサブドメインも許容）
  if (!url.hostname.endsWith("zoom.us")) {
    return { ok: false, error: "Zoom (zoom.us) のURLを指定してください" };
  }

  // /j/{meeting_id} パスを期待
  const match = url.pathname.match(/^\/j\/(\d+)$/);
  if (!match) {
    return {
      ok: false,
      error:
        "Zoom参加URL（https://zoom.us/j/... の形式）を指定してください。録画共有URL等は使えません",
    };
  }

  const meetingId = match[1];

  // meetingIdの長さチェック（通常10-11桁、最低9桁）
  if (meetingId.length < 9) {
    return { ok: false, error: "meeting IDが短すぎます" };
  }

  return {
    ok: true,
    meetingId,
    cleanUrl: trimmed,
  };
}
