/**
 * 接触履歴 V2 のサーバーアクション入力型。
 * SLP / HOJO / STP の actions.ts で共通使用。
 */

import type { ActionResult } from "@/lib/action-result";

export type AttendeeInput = {
  name: string;
  title?: string | null;
};

export type CustomerParticipantInput = {
  targetType: string;
  targetId?: number | null;
  attendees?: AttendeeInput[];
};

export type FileInput = {
  id?: number; // 編集時に既存ファイルを識別
  filePath?: string | null;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  url?: string | null;
};

export type MeetingInput = {
  id?: number; // 編集時: 既存の会議ID (更新判定用)
  provider: string; // "zoom" | "google_meet" | "teams" | "other"
  label?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  joinUrl?: string | null;
  startUrl?: string | null;
  passcode?: string | null;
  hostStaffId?: number | null;
  state?: string; // "予定" | "進行中" | "完了" | "失敗" | "取得中"
};

export type ContactHistoryV2Input = {
  title?: string | null;
  status: string; // "scheduled" | "completed" | "cancelled" | "rescheduled"
  scheduledStartAt: string; // ISO 文字列
  scheduledEndAt?: string | null;
  contactMethodId?: number | null;
  contactCategoryId?: number | null;
  meetingMinutes?: string | null;
  note?: string | null;
  customers: CustomerParticipantInput[];
  staffIds: number[];
  hostStaffId?: number | null;
  meetings?: MeetingInput[];
  files?: FileInput[];
};

/** フォームから呼び出すサーバーアクションのシグネチャ */
export type CreateContactHistoryV2Action = (
  input: ContactHistoryV2Input,
) => Promise<ActionResult<{ id: number }>>;

export type UpdateContactHistoryV2Action = (
  id: number,
  input: ContactHistoryV2Input,
) => Promise<ActionResult<{ id: number }>>;
