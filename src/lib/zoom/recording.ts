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
  recording: ZoomRecordingPayload;
  /** 既にDL済みのファイルはスキップ（再実行時のため） */
  skipMp4?: boolean;
  skipTranscript?: boolean;
  skipChat?: boolean;
}): Promise<DownloadedRecording> {
  const ctx = await requireStaffZoomContext(params.hostStaffId);

  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const relDir = path.posix.join(
    STORAGE_ROOT_REL,
    yyyyMm,
    String(params.contactHistoryId)
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
 * Note: meeting_id (numeric) で /meetings/{id}/recordings を呼ぶ。UUID 形式は別エンドポイント。
 */
export async function fetchRecordingMetadata(input: {
  hostStaffId: number;
  meetingId: bigint | number | string;
}): Promise<ZoomRecordingPayload | null> {
  const ctx = await requireStaffZoomContext(input.hostStaffId);
  const meetingKey =
    typeof input.meetingId === "string"
      ? encodeURIComponent(input.meetingId)
      : input.meetingId.toString();
  try {
    const resp = await fetch(`https://api.zoom.us/v2/meetings/${meetingKey}/recordings`, {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      if (resp.status === 404) return null;
      throw new Error(`Zoom recording metadata 取得失敗: ${resp.status}`);
    }
    const data = (await resp.json()) as ZoomRecordingPayload;
    return data;
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
