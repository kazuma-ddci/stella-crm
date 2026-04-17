/**
 * SLP予約中継URL用ヘルパー
 *
 * uid → SlpLineFriend → 担当者として紐付く企業レコード一覧 を取得する。
 * 概要案内・導入希望商談どちらの中継ページからも参照される。
 *
 * Phase 4 でセッションベース (SlpMeetingSession) に対応。
 * 過去に「完了」しているが現在「予約中/未予約」がない状態でも、
 * 顧客は追加の予約を作成できる（ユーザー仕様: 「完了済み」でも再度予約可能）。
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export type CandidateCompany = {
  recordId: number;
  companyName: string | null;
  businessType: string | null;
  // 概要案内の現状
  briefingHasActiveReservation: boolean; // 予約中 or 未予約セッションがある
  briefingCompletedOnce: boolean; // 過去に完了しているセッションが1つ以上ある
  briefingActiveScheduledAt: Date | null; // アクティブセッションの日時（あれば）
  briefingActiveSource: "proline" | "manual" | null; // アクティブセッションのソース
  // 導入希望商談の現状
  consultationHasActiveReservation: boolean;
  consultationCompletedOnce: boolean;
  consultationActiveScheduledAt: Date | null;
  consultationActiveSource: "proline" | "manual" | null;
};

export type ResolveResult =
  | {
      found: true;
      lineFriendId: number;
      snsname: string | null;
      companies: CandidateCompany[];
    }
  | { found: false; reason: "uid_missing" | "line_friend_not_found" };

/**
 * uidから担当者情報と担当企業を解決する
 */
export async function resolveContactCompanies(
  uid: string | null
): Promise<ResolveResult> {
  if (!uid) return { found: false, reason: "uid_missing" };

  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid },
    select: { id: true, snsname: true },
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
          businessType: true,
          meetingSessions: {
            where: { deletedAt: null },
            select: {
              category: true,
              status: true,
              source: true,
              scheduledAt: true,
              createdAt: true,
              roundNumber: true,
            },
            orderBy: [{ roundNumber: "desc" }, { createdAt: "desc" }],
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const seen = new Set<number>();
  const companies: CandidateCompany[] = [];
  for (const c of contacts) {
    const r = c.companyRecord;
    if (!r) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    const briefingSessions = r.meetingSessions.filter(
      (s) => s.category === "briefing"
    );
    const consultationSessions = r.meetingSessions.filter(
      (s) => s.category === "consultation"
    );

    const briefingActive = briefingSessions.find(
      (s) => s.status === "予約中" || s.status === "未予約"
    );
    const briefingCompletedOnce = briefingSessions.some(
      (s) => s.status === "完了"
    );

    const consultationActive = consultationSessions.find(
      (s) => s.status === "予約中" || s.status === "未予約"
    );
    const consultationCompletedOnce = consultationSessions.some(
      (s) => s.status === "完了"
    );

    companies.push({
      recordId: r.id,
      companyName: r.companyName,
      businessType: r.businessType,
      briefingHasActiveReservation: !!briefingActive,
      briefingCompletedOnce,
      briefingActiveScheduledAt: briefingActive?.scheduledAt ?? null,
      briefingActiveSource:
        (briefingActive?.source as "proline" | "manual" | null | undefined) ??
        null,
      consultationHasActiveReservation: !!consultationActive,
      consultationCompletedOnce,
      consultationActiveScheduledAt: consultationActive?.scheduledAt ?? null,
      consultationActiveSource:
        (consultationActive?.source as "proline" | "manual" | null | undefined) ??
        null,
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
