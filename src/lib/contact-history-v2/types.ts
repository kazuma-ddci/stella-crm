import type { Prisma } from "@prisma/client";

/**
 * 接触履歴 統一版（Phase 1）の共通型定義。
 * プロジェクト（SLP / HOJO / STP）を横断で利用する。
 *
 * 旧 src/app/slp/contact-histories/format.ts の役割を
 * 統一版に置き換える形で実装する。
 */

/**
 * 顧客側参加エンティティの targetType 一覧。
 * 多態参照の値をTypeScript型としても保持。
 */
export const CONTACT_TARGET_TYPES = [
  "stp_company",
  "stp_agent",
  "hojo_vendor",
  "hojo_bbs",
  "hojo_lender",
  "hojo_other",
  "slp_company_record",
  "slp_agency",
  "slp_line_friend",
] as const;

export type ContactTargetType = (typeof CONTACT_TARGET_TYPES)[number];

/**
 * 先方参加者の sourceType 一覧。
 * 既存担当者マスタと連携 or 手入力。
 */
export const ATTENDEE_SOURCE_TYPES = [
  "stella_contact",
  "slp_company_contact",
  "slp_agency_contact",
  "hojo_vendor_contact",
  "manual",
] as const;

export type AttendeeSourceType = (typeof ATTENDEE_SOURCE_TYPES)[number];

/**
 * 接触履歴のステータス。
 */
export const CONTACT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * 接触履歴の作成元（どこから作られた接触か）。
 */
export const CONTACT_SOURCE_TYPES = [
  "manual",
  "slack",
  "telegram",
  "google_calendar",
  "api",
] as const;

export type ContactSourceType = (typeof CONTACT_SOURCE_TYPES)[number];

/**
 * 接触履歴を一覧・詳細表示する時の標準 include。
 * 参加者・スタッフ・ファイルを含めてまとめて取得する。
 */
export const contactHistoryV2DisplayInclude = {
  project: { select: { id: true, code: true, name: true } },
  contactMethod: { select: { id: true, name: true } },
  contactCategory: { select: { id: true, name: true, projectId: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  customerParticipants: {
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }, { id: "asc" }],
    include: {
      attendees: {
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      },
    },
  },
  staffParticipants: {
    orderBy: [{ isHost: "desc" }, { createdAt: "asc" }],
    include: {
      staff: { select: { id: true, name: true, isActive: true } },
    },
  },
  files: {
    orderBy: { createdAt: "desc" },
  },
} as const satisfies Prisma.ContactHistoryV2Include;

/**
 * 上記 include を適用した時の Prisma 型。
 * サーバー / クライアント間で接触履歴の型を共有する際に使用する。
 */
export type ContactHistoryV2WithRelations = Prisma.ContactHistoryV2GetPayload<{
  include: typeof contactHistoryV2DisplayInclude;
}>;

/**
 * 顧客側参加エンティティ（attendeesを含む）
 */
export type ContactCustomerParticipantWithAttendees =
  ContactHistoryV2WithRelations["customerParticipants"][number];

/**
 * 弊社スタッフ参加者（staff情報を含む）
 */
export type ContactStaffParticipantWithStaff =
  ContactHistoryV2WithRelations["staffParticipants"][number];

/**
 * 表示用ラベル取得ヘルパー
 */
export function getTargetTypeLabel(targetType: string): string {
  switch (targetType) {
    case "stp_company":
      return "STP企業";
    case "stp_agent":
      return "STP代理店";
    case "hojo_vendor":
      return "ベンダー";
    case "hojo_bbs":
      return "BBS";
    case "hojo_lender":
      return "貸金業者";
    case "hojo_other":
      return "その他";
    case "slp_company_record":
      return "事業者";
    case "slp_agency":
      return "代理店";
    case "slp_line_friend":
      return "LINE友達";
    default:
      return targetType;
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "予定";
    case "completed":
      return "実施済";
    case "cancelled":
      return "キャンセル";
    case "rescheduled":
      return "リスケ";
    default:
      return status;
  }
}

export function getStatusBadgeTone(status: string): "scheduled" | "completed" | "cancelled" | "neutral" {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "completed":
      return "completed";
    case "cancelled":
    case "rescheduled":
      return "cancelled";
    default:
      return "neutral";
  }
}
