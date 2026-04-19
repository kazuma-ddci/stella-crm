import fs from "fs/promises";
import path from "path";
import { requireStaffZoomContext } from "./client";

// Zoom Cloud Recording の情報を元に mp4 と transcript をVPSに保存する。
// 保存先: /public/uploads/slp/zoom-recordings/{YYYY-MM}/{contactHistoryId}/

export type ZoomRecordingFile = {
  id?: string;
  meeting_id?: string;
  recording_start?: string;
  recording_end?: string;
  file_type: string; // "MP4" | "M4A" | "TRANSCRIPT" | "CHAT" | "CC"等
  file_extension?: string;
  file_size?: number;
  play_url?: string;
  download_url: string;
  status?: string;
  recording_type?: string;
};

export type ZoomRecordingPayload = {
  id: string | number; // meeting id (numeric)
  uuid: string;
  host_id: string;
  topic: string;
  start_time?: string;
  duration?: number;
  recording_files: ZoomRecordingFile[];
};

const STORAGE_ROOT_REL = path.posix.join(
  "uploads",
  "slp",
  "zoom-recordings"
);

function getStorageRootAbs(): string {
  return path.join(process.cwd(), "public", ...STORAGE_ROOT_REL.split("/"));
}

export type DownloadedRecording = {
  mp4RelPath: string | null;
  mp4Size: number | null;
  mp4FileId: string | null;
  transcriptRelPath: string | null;
  transcriptText: string | null;
  transcriptFileId: string | null;
  chatRelPath: string | null;
  chatText: string | null;
  chatFileId: string | null;
};

/**
 * Zoom 録画をダウンロードしてVPSに保存する。
 * download_token付きURLへは `access_token` を付与することでダウンロード可能。
 * recording.completed Webhookのpayloadには `download_token` が含まれることがあるが、
 * OAuthアクセストークン（有効期間内）でも同じURLからDL可能。
 *
 * 取得対象:
 *  - MP4 (動画) — 1つだけ（shared_screen_with_speaker_view を優先）
 *  - TRANSCRIPT (字幕 .vtt)
 *  - CHAT (会議中チャットログ .txt)
 */
export async function downloadZoomRecordingFiles(params: {
  hostStaffId: number;
  contactHistoryId: number;
  /** Recording ID（1つの接触履歴に複数Recording紐付き得るので、ID毎のサブディレクトリに保存する） */
  recordingId: number;
  recording: ZoomRecordingPayload;
  /** 既にDL済みのファイルはスキップ（再実行時のため） */
  skipMp4?: boolean;
  skipTranscript?: boolean;
  skipChat?: boolean;
}): Promise<DownloadedRecording> {
  const ctx = await requireStaffZoomContext(params.hostStaffId);

  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // 1接触履歴に複数Recording紐付くケースに備えて Recording ID サブディレクトリを追加し
  // ファイルパス衝突（同名で別Recordingの録画が上書きされる事故）を防止する
  const relDir = path.posix.join(
    STORAGE_ROOT_REL,
    yyyyMm,
    String(params.contactHistoryId),
    `rec_${params.recordingId}`
  );
  const absDir = path.join(process.cwd(), "public", relDir);
  await fs.mkdir(absDir, { recursive: true });

  let mp4RelPath: string | null = null;
  let mp4Size: number | null = null;
  let mp4FileId: string | null = null;
  let transcriptRelPath: string | null = null;
  let transcriptText: string | null = null;
  let transcriptFileId: string | null = null;
  let chatRelPath: string | null = null;
  let chatText: string | null = null;
  let chatFileId: string | null = null;

  for (const file of params.recording.recording_files) {
    if (file.status && file.status !== "completed") continue;
    const ext = (file.file_extension || file.file_type || "bin")
      .toLowerCase()
      .replace(/^\./, "");

    // mp4を1つだけ選ぶ（shared_screen_with_speaker_view を優先）
    if (file.file_type === "MP4" && !mp4RelPath && !params.skipMp4) {
      const filename = `recording.${ext}`;
      const absPath = path.join(absDir, filename);
      const buf = await downloadToBuffer(file.download_url, ctx.accessToken);
      await fs.writeFile(absPath, buf);
      mp4RelPath = path.posix.join("/", relDir, filename);
      mp4Size = buf.byteLength;
      mp4FileId = file.id ?? null;
      continue;
    }

    if (file.file_type === "TRANSCRIPT" && !params.skipTranscript) {
      const filename = `transcript.${ext || "vtt"}`;
      const absPath = path.join(absDir, filename);
      const buf = await downloadToBuffer(file.download_url, ctx.accessToken);
      await fs.writeFile(absPath, buf);
      transcriptRelPath = path.posix.join("/", relDir, filename);
      transcriptText = vttToPlainText(buf.toString("utf8"));
      transcriptFileId = file.id ?? null;
      continue;
    }

    if (file.file_type === "CHAT" && !params.skipChat) {
      const filename = `chat.${ext || "txt"}`;
      const absPath = path.join(absDir, filename);
      const buf = await downloadToBuffer(file.download_url, ctx.accessToken);
      await fs.writeFile(absPath, buf);
      chatRelPath = path.posix.join("/", relDir, filename);
      chatText = buf.toString("utf8");
      chatFileId = file.id ?? null;
      continue;
    }
  }

  // TRANSCRIPTフォールバック: /recordings の recording_files から TRANSCRIPT が取れなかった場合、
  // 新API /meetings/{id}/transcript を叩く。AI Companion連携会議で recording_files から
  // TRANSCRIPTが除外されるZoom挙動への対応。UUID → Numeric ID の順で試す。
  if (!transcriptRelPath && !params.skipTranscript) {
    const keys: string[] = [];
    if (params.recording.uuid) keys.push(params.recording.uuid);
    if (params.recording.id !== undefined && params.recording.id !== null) {
      keys.push(String(params.recording.id));
    }
    for (const key of keys) {
      try {
        const r = await fetchMeetingTranscript({
          hostStaffId: params.hostStaffId,
          meetingKey: key,
        });
        if (r.status === "downloaded") {
          const filename = `transcript.vtt`;
          const absPath = path.join(absDir, filename);
          await fs.writeFile(absPath, r.vtt, "utf8");
          transcriptRelPath = path.posix.join("/", relDir, filename);
          transcriptText = r.text;
          break;
        }
        if (
          r.status === "no_data" ||
          r.status === "deleted" ||
          r.status === "unsupported"
        ) {
          // 確定的に取れない → 次のキーで試しても無駄
          break;
        }
        // not_ready / not_found は次のキーで再試行
      } catch {
        // 個別キーの失敗は握りつぶして次のキーへ（片方のキーが壊れていても
        // もう片方で取れる可能性がある）
      }
    }
  }

  return {
    mp4RelPath,
    mp4Size,
    mp4FileId,
    transcriptRelPath,
    transcriptText,
    transcriptFileId,
    chatRelPath,
    chatText,
    chatFileId,
  };
}

/**
 * Zoom Cloud Recording API から指定会議の recording_files 一覧を再取得する。
 * 手動取得時に Webhook ペイロードを失っている場合や、まだ取得していないファイルを後追いで処理する用途。
 *
 * 挙動:
 * 1) まず Numeric ID（または渡された ID そのもの）で /meetings/{id}/recordings を呼ぶ
 * 2) 返ってきた payload に MP4 or TRANSCRIPT が無く、UUID が取れている場合は
 *    UUID で再度 /meetings/{UUID}/recordings を呼んで上書き取得
 *    （Zoom の挙動: 過去の会議では Numeric ID が別インスタンスを指してしまい、
 *     file_type "MP4"/"TRANSCRIPT" が payload に出ないケースがあるため、
 *     UUID による特定インスタンス参照で補完する）
 *
 * UUID のURLエンコード:
 *   UUID が "/" で始まる or "//" を含む場合、Zoom API の仕様上 **二重 URL encode** が必要。
 */
export async function fetchRecordingMetadata(input: {
  hostStaffId: number;
  meetingId: bigint | number | string;
}): Promise<ZoomRecordingPayload | null> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);

  const callByKey = async (
    key: string
  ): Promise<ZoomRecordingPayload | null> => {
    const resp = await fetch(
      `https://api.zoom.us/v2/meetings/${key}/recordings`,
      {
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (resp.status === 404) return null;
    if (!resp.ok) {
      throw new Error(`Zoom recording metadata 取得失敗: ${resp.status}`);
    }
    return (await resp.json()) as ZoomRecordingPayload;
  };

  const hasEssentialFiles = (p: ZoomRecordingPayload): boolean => {
    return p.recording_files.some(
      (f) => f.file_type === "MP4" || f.file_type === "TRANSCRIPT"
    );
  };

  const encodeUuidForZoom = (uuid: string): string => {
    // "/" で始まる or "//" を含む UUID は二重 URL encode が必要（Zoom API仕様）
    const needsDoubleEncode = uuid.startsWith("/") || uuid.includes("//");
    return needsDoubleEncode
      ? encodeURIComponent(encodeURIComponent(uuid))
      : encodeURIComponent(uuid);
  };

  // Numeric ID 側のキー（または string そのまま）
  const primaryKey =
    typeof input.meetingId === "string"
      ? encodeURIComponent(input.meetingId)
      : input.meetingId.toString();

  try {
    const primary = await callByKey(primaryKey);
    if (!primary) return null;

    // 1回目で必須ファイル（MP4 or TRANSCRIPT）が揃っていればそれを返す
    if (hasEssentialFiles(primary)) {
      console.info(
        `[fetchRecordingMetadata] primary has essential files. files=${primary.recording_files
          .map((f) => f.file_type)
          .join(",")}`
      );
      return primary;
    }

    // 欠損 → UUID で再試行（Zoom の過去会議対策）
    console.warn(
      `[fetchRecordingMetadata] primary missing MP4/TRANSCRIPT. types=${primary.recording_files
        .map((f) => f.file_type)
        .join(",")}; trying UUID fallback: ${primary.uuid}`
    );
    if (primary.uuid) {
      try {
        const byUuid = await callByKey(encodeUuidForZoom(primary.uuid));
        if (byUuid) {
          console.info(
            `[fetchRecordingMetadata] UUID fallback returned. hasEssentialFiles=${hasEssentialFiles(
              byUuid
            )}, types=${byUuid.recording_files.map((f) => f.file_type).join(",")}`
          );
        }
        if (byUuid && hasEssentialFiles(byUuid)) {
          return byUuid;
        }
        // UUID でも不完全ならとりあえず UUID 側を返す（recording_times 等含むほうが多い）
        if (byUuid) return byUuid;
      } catch (uuidErr) {
        // UUID fallback 失敗でも primary は有効なので投げない
        console.error(
          "[fetchRecordingMetadata] UUID fallback failed:",
          uuidErr
        );
      }
    }

    // fallback 不可 → 不完全でも primary を返す（呼び出し側が "no_recording" 等で処理）
    return primary;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

async function downloadToBuffer(
  url: string,
  accessToken: string
): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15 * 60 * 1000), // 15分
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoom録画DL失敗: ${res.status} ${text.slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * /meetings/{id}/transcript の応答型（Zoom 2026-04 時点の新API）
 *
 * AI Companion 連携が進んだ会議では /recordings の recording_files から
 * TRANSCRIPT が除外されるケースがあるため、この専用APIで補完取得する。
 */
export type MeetingTranscriptResult =
  | {
      status: "downloaded";
      vtt: string;
      text: string;
      transcriptCreatedTime: string | null;
    }
  | { status: "not_ready" } // 処理中。後でリトライすれば取れる
  | { status: "no_data" } // そもそも文字起こしデータなし（確定）
  | { status: "deleted" } // 削除済み or ゴミ箱（確定）
  | { status: "unsupported" } // 非対応（確定）
  | { status: "not_found" }; // 404（meeting自体が無い）

/**
 * Zoom 文字起こし専用APIを叩いて transcript 本文を取得する。
 *
 * 既存の /meetings/{id}/recordings の recording_files に TRANSCRIPT が
 * 含まれない場合のフォールバックとして使う。
 */
export async function fetchMeetingTranscript(input: {
  hostStaffId: number;
  /** Numeric Meeting ID または UUID */
  meetingKey: string;
}): Promise<MeetingTranscriptResult> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);

  // UUID "/" 始まり or "//" 含みは二重URLエンコード必須（/recordings と同じ仕様）
  const encodeKey = (k: string): string => {
    if (/^\d+$/.test(k)) return k; // numeric meeting id はそのまま
    const needsDoubleEncode = k.startsWith("/") || k.includes("//");
    return needsDoubleEncode
      ? encodeURIComponent(encodeURIComponent(k))
      : encodeURIComponent(k);
  };

  const url = `https://api.zoom.us/v2/meetings/${encodeKey(input.meetingKey)}/transcript`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
    signal: AbortSignal.timeout(30000),
  });

  if (resp.status === 404) return { status: "not_found" };
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Zoom transcript API 失敗: ${resp.status} ${text.slice(0, 200)}`
    );
  }

  const payload = (await resp.json()) as {
    transcript_created_time?: string;
    can_download?: boolean;
    download_url?: string | null;
    download_restriction_reason?:
      | "DELETED_OR_TRASHED"
      | "UNSUPPORTED"
      | "NO_TRANSCRIPT_DATA"
      | "NOT_READY"
      | null;
  };

  if (!payload.can_download || !payload.download_url) {
    const reason = payload.download_restriction_reason;
    if (reason === "NOT_READY") return { status: "not_ready" };
    if (reason === "NO_TRANSCRIPT_DATA") return { status: "no_data" };
    if (reason === "DELETED_OR_TRASHED") return { status: "deleted" };
    if (reason === "UNSUPPORTED") return { status: "unsupported" };
    return { status: "no_data" };
  }

  const buf = await downloadToBuffer(payload.download_url, ctx.accessToken);
  const vtt = buf.toString("utf8");
  return {
    status: "downloaded",
    vtt,
    text: vttToPlainText(vtt),
    transcriptCreatedTime: payload.transcript_created_time ?? null,
  };
}

/** VTT形式の字幕をプレーンテキスト（時刻・タグ除去）に変換 */
export function vttToPlainText(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "WEBVTT") continue;
    if (/^NOTE\b/i.test(t)) continue;
    if (/^\d+$/.test(t)) continue; // cue番号
    if (/-->/.test(t)) continue; // タイムスタンプ行
    // HTMLタグ風の <v Speaker> を除去
    const cleaned = t.replace(/<[^>]+>/g, "").trim();
    if (cleaned) out.push(cleaned);
  }
  return out.join("\n");
}
