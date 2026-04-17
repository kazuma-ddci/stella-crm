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
  startAtJst: Date; // 開始日時（UTC instant、JST wall-clockでZoomに送信される）
  durationMinutes?: number; // デフォルト60
};

/**
 * Date instant を "YYYY-MM-DDTHH:mm:ss"（Zなし JST wall-clock）形式に変換
 *
 * Zoom API 仕様:
 *   - start_time が "Z" 付き → UTC として処理、timezone 無視
 *   - start_time が "Z" なし → timezone field で解釈
 * そのため `"Asia/Tokyo"` の wall-clock を Zなし形式で送ると、Zoom管理画面で
 * JSTの壁時計時刻として正しく表示される。
 *
 * 実装: "sv-SE" ロケールは常に "YYYY-MM-DD HH:mm:ss" を返し、深夜0時も
 * "24:00" ではなく "00:00" として扱うため、安定して JST 壁時計文字列を生成できる。
 */
function toJstWallClockIso(d: Date): string {
  const jstStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  // sv-SE の戻り値 "2026-04-23 10:00:00" → ISO風 "2026-04-23T10:00:00"
  return jstStr.replace(" ", "T");
}

/**
 * Zoom会議を作成。hostStaffIdのZoomアカウントで発行する。
 * 設定: Cloud Recording + AI Companion自動ON、待機室ON、パスワード無し、1時間。
 */
export async function createZoomMeeting(
  input: CreateMeetingInput
): Promise<ZoomMeetingCreateResponse> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  // JST wall-clock（"Z"なし）+ timezone:Asia/Tokyo で送信 → Zoomが JST として処理
  const startTimeStr = toJstWallClockIso(input.startAtJst);
  const body = {
    topic: input.topic,
    type: 2, // scheduled
    start_time: startTimeStr,
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
    // JST wall-clock（"Z"なし）+ timezone:Asia/Tokyo で送信
    body.start_time = toJstWallClockIso(input.startAtJst);
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
 * 過去の会議の参加者情報を取得（user-level scope）。
 * scope: meeting:read:list_past_participants
 *
 * 取れる項目: 名前、Email、user_id、入退室時刻、参加時間（duration秒）
 * デバイス情報は取れない（取得には dashboard_meetings:read:admin が必要）。
 *
 * UUID が "/" を含む場合や "==" で終わる場合は二重エンコード必要。
 */
export type ZoomPastParticipant = {
  id: string;
  name: string;
  user_email: string | null;
  user_id: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration: number; // 秒
  registrant_id: string | null;
  failover: boolean | null;
  status: string | null;
};

export async function getPastMeetingParticipants(input: {
  hostStaffId: number;
  meetingUuid: string;
}): Promise<ZoomPastParticipant[]> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const uuid = encodeZoomUuid(input.meetingUuid);
  const allParticipants: ZoomPastParticipant[] = [];
  let nextPageToken: string | undefined = undefined;
  try {
    do {
      const url: string = `/past_meetings/${uuid}/participants?page_size=300${
        nextPageToken
          ? `&next_page_token=${encodeURIComponent(nextPageToken)}`
          : ""
      }`;
      const resp: {
        participants?: Array<Partial<ZoomPastParticipant>>;
        next_page_token?: string;
      } = await zoomFetchJson(ctx.accessToken, url);

      for (const p of resp.participants ?? []) {
        allParticipants.push({
          id: p.id ?? "",
          name: p.name ?? "",
          user_email: p.user_email ?? null,
          user_id: p.user_id ?? null,
          join_time: p.join_time ?? null,
          leave_time: p.leave_time ?? null,
          duration: typeof p.duration === "number" ? p.duration : 0,
          registrant_id: p.registrant_id ?? null,
          failover: p.failover ?? null,
          status: p.status ?? null,
        });
      }
      nextPageToken = resp.next_page_token || undefined;
    } while (nextPageToken);
  } catch (err) {
    if (
      err instanceof ZoomApiError &&
      (err.status === 404 || err.status === 400 || err.status === 403)
    ) {
      // 404/400 = 会議未終了 or UUID間違い
      // 403 = scope 不足
      return [];
    }
    throw err;
  }
  return allParticipants;
}

/**
 * 旧名互換（先方参加者抽出機能で使用）。
 * 内部で getPastMeetingParticipants を呼ぶラッパー。
 */
export async function getZoomMeetingParticipants(input: {
  hostStaffId: number;
  meetingUuid: string;
}): Promise<Array<{ id: string; name: string; user_email?: string | null }>> {
  const list = await getPastMeetingParticipants(input);
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    user_email: p.user_email,
  }));
}

/**
 * Zoom AI Companion 要約の取得（Meeting Summary）。
 * Zoom側設定で有効化されている場合のみ結果が返る。
 * next_steps（アクションアイテム）も別途返す。
 */
export type ZoomMeetingSummary = {
  summaryText: string | null; // overview + details を整形済みテキスト
  nextSteps: string | null; // アクションアイテム
  raw: unknown;
};

export async function getZoomMeetingSummary(input: {
  hostStaffId: number;
  meetingUuid: string;
}): Promise<ZoomMeetingSummary> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const uuid = encodeZoomUuid(input.meetingUuid);
  try {
    const resp = await zoomFetchJson<{
      summary_details?: Array<{ label?: string; summary?: string }>;
      summary_overview?: string;
      next_steps?: Array<string | { description?: string; assignee?: string }>;
    }>(ctx.accessToken, `/meetings/${uuid}/meeting_summary`);
    const parts: string[] = [];
    if (resp.summary_overview) parts.push(resp.summary_overview);
    if (resp.summary_details?.length) {
      for (const d of resp.summary_details) {
        if (d.summary) parts.push(`【${d.label ?? ""}】\n${d.summary}`);
      }
    }
    const summaryText = parts.length > 0 ? parts.join("\n\n") : null;

    let nextSteps: string | null = null;
    if (resp.next_steps?.length) {
      const items = resp.next_steps.map((s) => {
        if (typeof s === "string") return `・${s}`;
        if (s.description) {
          return s.assignee
            ? `・[${s.assignee}] ${s.description}`
            : `・${s.description}`;
        }
        return "";
      }).filter(Boolean);
      if (items.length > 0) nextSteps = items.join("\n");
    }

    return { summaryText, nextSteps, raw: resp };
  } catch (err) {
    if (
      err instanceof ZoomApiError &&
      (err.status === 404 || err.status === 400)
    ) {
      return { summaryText: null, nextSteps: null, raw: null };
    }
    throw err;
  }
}
