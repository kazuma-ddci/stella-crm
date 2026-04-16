import { requireStaffZoomContext, zoomFetchJson, ZoomApiError } from "./client";

/**
 * Zoom UUIDのURL埋め込み用エンコード。
 * Zoom仕様: UUIDが "/" で始まるか "//" を含む場合は二重URLエンコード必要。
 * それ以外は単一エンコード。
 */
function encodeZoomUuid(uuid: string): string {
  if (uuid.startsWith("/") || uuid.includes("//")) {
    return encodeURIComponent(encodeURIComponent(uuid));
  }
  return encodeURIComponent(uuid);
}

// Zoom API Meeting 型（必要部分のみ）
export type ZoomMeetingCreateResponse = {
  id: number;
  uuid?: string;
  host_id?: string;
  topic: string;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
  password?: string;
  encrypted_password?: string;
  settings?: {
    waiting_room?: boolean;
    auto_recording?: string;
  };
};

export type CreateMeetingInput = {
  hostStaffId: number;
  topic: string;
  startAtJst: Date; // 開始日時（JST想定・UTCに変換して送信）
  durationMinutes?: number; // デフォルト60
};

/**
 * Zoom会議を作成。hostStaffIdのZoomアカウントで発行する。
 * 設定: Cloud Recording + AI Companion自動ON、待機室ON、パスワード無し、1時間。
 */
export async function createZoomMeeting(
  input: CreateMeetingInput
): Promise<ZoomMeetingCreateResponse> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const startTimeIso = input.startAtJst.toISOString(); // UTC ISO
  const body = {
    topic: input.topic,
    type: 2, // scheduled
    start_time: startTimeIso,
    timezone: "Asia/Tokyo",
    duration: input.durationMinutes ?? 60,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
      auto_recording: "cloud",
      // AI Companion はZoom側のアカウント設定（全会議で自動要約ON）に従う
      // 明示的APIフラグは Zoom 側仕様変動があるため設定画面依存
    },
  };
  return zoomFetchJson<ZoomMeetingCreateResponse>(
    ctx.accessToken,
    `/users/me/meetings`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export type UpdateMeetingInput = {
  hostStaffId: number;
  meetingId: bigint | number;
  topic?: string;
  startAtJst?: Date;
  durationMinutes?: number;
};

/**
 * Zoom会議を更新（日時変更、タイトル変更）。担当者Zoomアカウントで実施。
 * 204を返すので戻り値なし。
 */
export async function updateZoomMeeting(
  input: UpdateMeetingInput
): Promise<void> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const body: Record<string, unknown> = {};
  if (input.topic !== undefined) body.topic = input.topic;
  if (input.startAtJst) {
    body.start_time = input.startAtJst.toISOString();
    body.timezone = "Asia/Tokyo";
  }
  if (input.durationMinutes !== undefined) body.duration = input.durationMinutes;

  await zoomFetchJson<void>(
    ctx.accessToken,
    `/meetings/${input.meetingId.toString()}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Zoom会議を削除。担当者Zoomアカウントで実施。
 * 404が返った場合は既に削除済みとして成功扱い。
 */
export async function deleteZoomMeeting(input: {
  hostStaffId: number;
  meetingId: bigint | number;
}): Promise<void> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  try {
    await zoomFetchJson<void>(
      ctx.accessToken,
      `/meetings/${input.meetingId.toString()}`,
      { method: "DELETE" }
    );
  } catch (err) {
    if (err instanceof ZoomApiError && err.status === 404) {
      return; // 既に削除済み
    }
    throw err;
  }
}

/**
 * Zoom Cloud Recording の特定ファイルを削除する。
 * cloud_recording:delete:recording_file スコープを使用。
 * action=trash（ゴミ箱） or delete（完全削除、デフォルト）
 */
export async function deleteZoomRecordingFile(input: {
  hostStaffId: number;
  meetingId: bigint | number | string;
  recordingId: string;
  action?: "trash" | "delete";
}): Promise<void> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const action = input.action ?? "trash";
  const meetingKey =
    typeof input.meetingId === "string"
      ? encodeZoomUuid(input.meetingId)
      : input.meetingId.toString();
  try {
    await zoomFetchJson<void>(
      ctx.accessToken,
      `/meetings/${meetingKey}/recordings/${encodeURIComponent(
        input.recordingId
      )}?action=${action}`,
      { method: "DELETE" }
    );
  } catch (err) {
    if (err instanceof ZoomApiError && err.status === 404) return;
    throw err;
  }
}

/**
 * Zoom会議の参加者一覧を取得（report API、有料プラン必要）。
 * host含む全参加者。先方参加者抽出時にスタッフ除外に使う。
 */
export async function getZoomMeetingParticipants(input: {
  hostStaffId: number;
  meetingUuid: string;
}): Promise<
  Array<{ id: string; name: string; user_email?: string | null }>
> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const uuid = encodeZoomUuid(input.meetingUuid);
  try {
    const resp = await zoomFetchJson<{
      participants?: Array<{ id: string; name: string; user_email?: string }>;
    }>(
      ctx.accessToken,
      `/report/meetings/${uuid}/participants?page_size=300`
    );
    return (resp.participants ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      user_email: p.user_email ?? null,
    }));
  } catch {
    // report APIはPro+（無料だと403）。無視して空配列
    return [];
  }
}

/**
 * Zoom AI Companion 要約の取得（Meeting Summary）。
 * Zoom側設定で有効化されている場合のみ結果が返る。
 */
export async function getZoomMeetingSummary(input: {
  hostStaffId: number;
  meetingUuid: string;
}): Promise<string | null> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const uuid = encodeZoomUuid(input.meetingUuid);
  try {
    const resp = await zoomFetchJson<{
      summary_details?: Array<{ label?: string; summary?: string }>;
      summary_overview?: string;
    }>(ctx.accessToken, `/meetings/${uuid}/meeting_summary`);
    const parts: string[] = [];
    if (resp.summary_overview) parts.push(resp.summary_overview);
    if (resp.summary_details?.length) {
      for (const d of resp.summary_details) {
        if (d.summary) parts.push(`【${d.label ?? ""}】\n${d.summary}`);
      }
    }
    return parts.length > 0 ? parts.join("\n\n") : null;
  } catch (err) {
    if (err instanceof ZoomApiError && (err.status === 404 || err.status === 400)) {
      return null;
    }
    throw err;
  }
}
