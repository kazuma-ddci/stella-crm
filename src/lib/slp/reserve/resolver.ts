/**
 * SLP予約中継URL用ヘルパー
 *
 * uid → SlpLineFriend → 担当者として紐付く企業レコード一覧 を取得する。
 * 概要案内・導入希望商談どちらの中継ページからも参照される。
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export type CandidateCompany = {
  recordId: number;
  companyName: string | null;
  briefingStatus: string | null;
  briefingDate: Date | null;
  consultationStatus: string | null;
  consultationDate: Date | null;
  /** 既に予約済みかどうか（briefing用判定） */
  briefingHasReservation: boolean;
  /** 既に予約済みかどうか（consultation用判定） */
  consultationHasReservation: boolean;
  /** 概要案内が完了しているか */
  briefingCompleted: boolean;
};

export type ResolveResult = {
  found: true;
  lineFriendId: number;
  snsname: string | null;
  companies: CandidateCompany[];
} | {
  found: false;
  reason: "uid_missing" | "line_friend_not_found";
};

/**
 * uidから担当者情報と担当企業を解決する
 */
export async function resolveContactCompanies(
  uid: string | null
): Promise<ResolveResult> {
  if (!uid) return { found: false, reason: "uid_missing" };

  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid },
    select: {
      id: true,
      snsname: true,
    },
  });

  if (!lineFriend) {
    return { found: false, reason: "line_friend_not_found" };
  }

  // この担当者が SlpCompanyContact として紐付いている企業を取得
  const contacts = await prisma.slpCompanyContact.findMany({
    where: {
      lineFriendId: lineFriend.id,
      companyRecord: { deletedAt: null },
    },
    select: {
      companyRecord: {
        select: {
          id: true,
          companyName: true,
          briefingStatus: true,
          briefingDate: true,
          briefingCanceledAt: true,
          consultationStatus: true,
          consultationDate: true,
          consultationCanceledAt: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // 重複排除（同じ企業に複数の担当者が登録されているケース）
  const seen = new Set<number>();
  const companies: CandidateCompany[] = [];
  for (const c of contacts) {
    const r = c.companyRecord;
    if (!r) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    // 概要案内: 「予約中」状態 = キャンセルされていない予約あり
    const briefingHasReservation =
      r.briefingStatus === "予約中" && r.briefingCanceledAt === null;

    // 概要案内が完了しているか
    const briefingCompleted = r.briefingStatus === "完了";

    // 導入希望商談: 「予約中」状態 = キャンセルされていない予約あり
    const consultationHasReservation =
      r.consultationStatus === "予約中" && r.consultationCanceledAt === null;

    companies.push({
      recordId: r.id,
      companyName: r.companyName,
      briefingStatus: r.briefingStatus,
      briefingDate: r.briefingDate,
      consultationStatus: r.consultationStatus,
      consultationDate: r.consultationDate,
      briefingHasReservation,
      consultationHasReservation,
      briefingCompleted,
    });
  }

  return {
    found: true,
    lineFriendId: lineFriend.id,
    snsname: lineFriend.snsname,
    companies,
  };
}

/**
 * 32バイトのランダムトークンを生成（hex 64文字）
 */
export function generateReservationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * ペンディング情報の有効期限（30分）
 */
export const PENDING_EXPIRES_MS = 30 * 60 * 1000;

/**
 * プロライン側のURL
 */
export const PROLINE_URLS = {
  briefingCalendar: "https://zcr5z7pk.autosns.app/cl/gUoC9cmzVa",
  consultationCalendar: "https://zcr5z7pk.autosns.app/cl/K2J5RCSPKm",
  bookingHistory: "https://zcr5z7pk.autosns.app/booking",
} as const;

export function buildBriefingCalendarUrl(uid: string): string {
  return `${PROLINE_URLS.briefingCalendar}?uid=${encodeURIComponent(uid)}`;
}

export function buildConsultationCalendarUrl(uid: string): string {
  return `${PROLINE_URLS.consultationCalendar}?uid=${encodeURIComponent(uid)}`;
}

export function buildBookingHistoryUrl(uid: string): string {
  return `${PROLINE_URLS.bookingHistory}?uid=${encodeURIComponent(uid)}`;
}
