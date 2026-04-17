import { prisma } from "@/lib/prisma";
import { MeetingSessionsCard } from "./meeting-sessions-card";
import type { SessionCategory, SessionStatus } from "@/lib/slp/session-helper";

export interface StaffOption {
  id: number;
  name: string;
}

export interface SessionZoomForUI {
  id: number;
  zoomMeetingId: string; // BigInt → string
  joinUrl: string;
  startUrl: string | null;
  scheduledAt: string | null;
  isPrimary: boolean;
  label: string | null;
  hostStaffName: string | null;
  hasRecording: boolean;
  zoomError: string | null;
  zoomErrorAt: string | null;
}

export interface SessionSummaryForUI {
  id: number;
  category: SessionCategory;
  roundNumber: number;
  status: SessionStatus;
  source: "proline" | "manual";
  bookedAt: string | null; // ISO: 予約発生日時（予約日）
  scheduledAt: string | null; // ISO: 実施予定日時（案内日/商談日）
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  prolineStaffName: string | null; // プロラインから来た担当者名（マッピング未登録時の警告用）
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  notes: string | null;
  prolineReservationId: string | null;
  cancelReason: string | null;
  noShowReason: string | null;
  createdByStaffName: string | null;
  createdAt: string;
  zooms: SessionZoomForUI[];
  hasRecording: boolean;
  contactHistoriesCount: number;
}

export interface CompanyContactForCompletion {
  id: number;
  name: string | null;
  lineFriendLabel: string | null;
}

export interface CompanySessionAlerts {
  duplicateBriefing: number; // 2件以上で重複
  duplicateConsultation: number;
  noShowTotal: number;
}

// 商談ブロック（Server Component - データ取得＋Clientへ受け渡し）
// SlpMeetingSession テーブルから直接読み取って表示する。
export async function MeetingSessionsSection({
  companyRecordId,
}: {
  companyRecordId: number;
}) {
  // SLP プロジェクトIDを先に取得（staff絞り込み用）
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [sessions, activeBriefing, activeConsultation, noShowTotal, staffAssignments, companyContacts] = await Promise.all([
    prisma.slpMeetingSession.findMany({
      where: { companyRecordId, deletedAt: null },
      orderBy: [{ category: "asc" }, { roundNumber: "asc" }, { createdAt: "asc" }],
      include: {
        assignedStaff: { select: { name: true } },
        createdByStaff: { select: { name: true } },
        // 新設計: Zoom情報は ContactHistory 配下の ZoomRecording に集約
        contactHistories: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          include: {
            zoomRecordings: {
              where: { deletedAt: null },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              include: {
                hostStaff: { select: { name: true } },
              },
            },
          },
        },
        _count: {
          select: {
            contactHistories: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        category: "briefing",
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        category: "consultation",
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        status: "飛び",
        deletedAt: null,
      },
    }),
    slpProject
      ? prisma.staffProjectAssignment.findMany({
          where: { projectId: slpProject.id, staff: { isActive: true, isSystemUser: false } },
          include: { staff: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.slpCompanyContact.findMany({
      where: { companyRecordId },
      include: {
        lineFriend: { select: { id: true, snsname: true, uid: true } },
      },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    }),
  ]);

  const staffOptions: StaffOption[] = staffAssignments
    .map((a) => ({ id: a.staff.id, name: a.staff.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const contactsForCompletion: CompanyContactForCompletion[] = companyContacts.map((c) => ({
    id: c.id,
    name: c.name,
    lineFriendLabel: c.lineFriend
      ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
      : null,
  }));

  const briefing: SessionSummaryForUI[] = [];
  const consultation: SessionSummaryForUI[] = [];

  for (const s of sessions) {
    const recordings = s.contactHistories[0]?.zoomRecordings ?? [];
    const zooms: SessionZoomForUI[] = recordings.map((z) => ({
      id: z.id,
      zoomMeetingId: z.zoomMeetingId.toString(),
      joinUrl: z.joinUrl,
      startUrl: z.startUrl,
      scheduledAt: z.scheduledAt?.toISOString() ?? null,
      isPrimary: z.isPrimary,
      label: z.label,
      hostStaffName: z.hostStaff?.name ?? null,
      hasRecording:
        z.state === "完了" ||
        !!z.aiCompanionSummary ||
        !!z.transcriptText ||
        !!z.mp4Path,
      zoomError: z.zoomApiError ?? null,
      zoomErrorAt: z.zoomApiErrorAt?.toISOString() ?? null,
    }));
    const summary: SessionSummaryForUI = {
      id: s.id,
      category: s.category as SessionCategory,
      roundNumber: s.roundNumber,
      status: s.status as SessionStatus,
      source: s.source as "proline" | "manual",
      bookedAt: s.bookedAt?.toISOString() ?? null,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      assignedStaffId: s.assignedStaffId,
      assignedStaffName: s.assignedStaff?.name ?? null,
      prolineStaffName: s.prolineStaffName ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      noShowAt: s.noShowAt?.toISOString() ?? null,
      notes: s.notes,
      prolineReservationId: s.prolineReservationId,
      cancelReason: s.cancelReason,
      noShowReason: s.noShowReason,
      createdByStaffName: s.createdByStaff?.name ?? null,
      createdAt: s.createdAt.toISOString(),
      zooms,
      hasRecording: zooms.some((z) => z.hasRecording),
      contactHistoriesCount: s._count.contactHistories,
    };
    if (s.category === "briefing") briefing.push(summary);
    else if (s.category === "consultation") consultation.push(summary);
  }

  const alerts: CompanySessionAlerts = {
    duplicateBriefing: activeBriefing,
    duplicateConsultation: activeConsultation,
    noShowTotal,
  };

  return (
    <MeetingSessionsCard
      companyRecordId={companyRecordId}
      briefingSessions={briefing}
      consultationSessions={consultation}
      alerts={alerts}
      staffOptions={staffOptions}
      contacts={contactsForCompletion}
    />
  );
}
