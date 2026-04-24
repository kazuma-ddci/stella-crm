import { prisma } from "@/lib/prisma";
import { getTargetTypeLabel } from "@/lib/contact-history-v2/types";

/**
 * V2 統一会議録画・議事録ページ用 loader。
 *
 * ContactHistoryMeetingRecord を起点に、関連する Meeting / ContactHistoryV2 /
 * 顧客参加者 / スタッフ / サマリー を取得して、一覧/詳細の共通形式に整形する。
 *
 * provider 抽象化: zoom/google_meet/teams/other の全てを同じ形式で扱う。
 * provider 固有のフィールド (AI Companion 要約など) は providerMetadata / MeetingRecord
 * 側の fields に格納される。
 */

export type MeetingRecordRow = {
  recordId: number; // MeetingRecord.id
  meetingId: number; // ContactHistoryMeeting.id
  contactHistoryId: number;
  provider: string;
  providerLabel: string;
  externalMeetingId: string | null;
  externalMeetingUuid: string | null;
  scheduledStartAt: Date;
  title: string | null;
  primaryCustomerLabel: string; // "株式会社X" or "先方顧客なし"
  customerTargetType: string | null;
  customerTargetId: number | null;
  hostStaffName: string | null;
  state: string;
  apiIntegrationStatus: string;
  downloadStatus: string;
  hasAiSummary: boolean;
  hasRecording: boolean;
  hasTranscript: boolean;
  hasChat: boolean;
  hasAttendance: boolean;
  recordingStartAt: Date | null;
  recordingEndAt: Date | null;
};

const providerLabels: Record<string, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Teams",
  other: "その他",
};

function providerLabel(p: string): string {
  return providerLabels[p] ?? p;
}

function resolvePrimaryCustomerLabel(
  customerParticipants: {
    targetType: string;
    targetId: number | null;
    isPrimary: boolean;
    displayOrder: number;
    companyName?: string | null;
  }[],
): { label: string; targetType: string | null; targetId: number | null } {
  if (customerParticipants.length === 0) {
    return { label: "—", targetType: null, targetId: null };
  }
  const primary =
    customerParticipants.find((c) => c.isPrimary) ?? customerParticipants[0];
  const name =
    primary.companyName ?? getTargetTypeLabel(primary.targetType);
  return {
    label: name,
    targetType: primary.targetType,
    targetId: primary.targetId,
  };
}

/**
 * 顧客エンティティ名の resolver。targetType に応じて企業/代理店/ベンダー等の名称を引く。
 * N+1 を避けるため、全 customerParticipants をまとめて解決する。
 */
async function enrichCustomerLabels(
  participants: {
    id: number;
    targetType: string;
    targetId: number | null;
  }[],
): Promise<Record<number, string | null>> {
  const result: Record<number, string | null> = {};
  // targetType 毎にまとめて取得
  const byType: Record<string, { id: number; targetId: number }[]> = {};
  for (const p of participants) {
    if (p.targetId == null) continue;
    if (!byType[p.targetType]) byType[p.targetType] = [];
    byType[p.targetType].push({ id: p.id, targetId: p.targetId });
  }

  // 各 targetType 毎に batch 取得
  for (const [type, list] of Object.entries(byType)) {
    const ids = list.map((l) => l.targetId);
    const idMap = new Map<number, string | null>();

    if (type === "stp_company") {
      const rows = await prisma.stpCompany.findMany({
        where: { id: { in: ids } },
        include: { company: { select: { name: true } } },
      });
      for (const r of rows) idMap.set(r.id, r.company?.name ?? null);
    } else if (type === "stp_agent") {
      const rows = await prisma.stpAgent.findMany({
        where: { id: { in: ids } },
        include: { company: { select: { name: true } } },
      });
      for (const r of rows) idMap.set(r.id, r.company?.name ?? null);
    } else if (type === "slp_company_record") {
      const rows = await prisma.slpCompanyRecord.findMany({
        where: { id: { in: ids } },
        select: { id: true, companyName: true },
      });
      for (const r of rows) idMap.set(r.id, r.companyName ?? null);
    } else if (type === "slp_agency") {
      const rows = await prisma.slpAgency.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      for (const r of rows) idMap.set(r.id, r.name ?? null);
    } else if (type === "slp_line_friend") {
      const rows = await prisma.slpLineFriend.findMany({
        where: { id: { in: ids } },
        select: { id: true, snsname: true, sei: true, mei: true, nickname: true },
      });
      for (const r of rows) {
        const name =
          r.nickname ||
          [r.sei, r.mei].filter(Boolean).join(" ") ||
          r.snsname ||
          null;
        idMap.set(r.id, name);
      }
    } else if (type === "hojo_vendor") {
      const rows = await prisma.hojoVendor.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      for (const r of rows) idMap.set(r.id, r.name ?? null);
    }

    for (const l of list) {
      result[l.id] = idMap.get(l.targetId) ?? null;
    }
  }

  return result;
}

export async function listMeetingRecordsForProject(params: {
  projectCode: "stp" | "slp" | "hojo";
  limit?: number;
}): Promise<MeetingRecordRow[]> {
  const limit = params.limit ?? 100;

  const project = await prisma.masterProject.findFirst({
    where: { code: params.projectCode },
    select: { id: true },
  });
  if (!project) return [];

  // MeetingRecord 起点で取得。対応する meeting の contactHistory.projectId で絞る。
  const records = await prisma.contactHistoryMeetingRecord.findMany({
    where: {
      meeting: {
        deletedAt: null,
        contactHistory: {
          deletedAt: null,
          projectId: project.id,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    include: {
      meeting: {
        include: {
          hostStaff: { select: { id: true, name: true } },
          contactHistory: {
            select: {
              id: true,
              title: true,
              scheduledStartAt: true,
              customerParticipants: {
                orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                select: {
                  id: true,
                  targetType: true,
                  targetId: true,
                  isPrimary: true,
                  displayOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // customerParticipants 全件をまとめて名前解決
  const allParticipants = records.flatMap((r) =>
    r.meeting.contactHistory.customerParticipants,
  );
  const nameMap = await enrichCustomerLabels(allParticipants);

  return records.map((r): MeetingRecordRow => {
    const enriched = r.meeting.contactHistory.customerParticipants.map((cp) => ({
      ...cp,
      companyName: nameMap[cp.id] ?? null,
    }));
    const primary = resolvePrimaryCustomerLabel(enriched);

    const attendance = r.attendanceJson;
    const hasAttendance =
      attendance !== null &&
      !(Array.isArray(attendance) && attendance.length === 0);

    return {
      recordId: r.id,
      meetingId: r.meeting.id,
      contactHistoryId: r.meeting.contactHistoryId,
      provider: r.meeting.provider,
      providerLabel: providerLabel(r.meeting.provider),
      externalMeetingId: r.meeting.externalMeetingId,
      externalMeetingUuid: r.meeting.externalMeetingUuid,
      scheduledStartAt: r.meeting.contactHistory.scheduledStartAt,
      title: r.meeting.contactHistory.title,
      primaryCustomerLabel: primary.label,
      customerTargetType: primary.targetType,
      customerTargetId: primary.targetId,
      hostStaffName: r.meeting.hostStaff?.name ?? null,
      state: r.meeting.state,
      apiIntegrationStatus: r.meeting.apiIntegrationStatus,
      downloadStatus: r.downloadStatus,
      hasAiSummary: !!r.aiSummary,
      hasRecording: !!r.recordingPath,
      hasTranscript: !!r.transcriptText,
      hasChat: !!r.chatLogText,
      hasAttendance,
      recordingStartAt: r.recordingStartAt,
      recordingEndAt: r.recordingEndAt,
    };
  });
}

export type MeetingRecordDetail = {
  recordId: number;
  meetingId: number;
  contactHistoryId: number;
  projectCode: string;
  provider: string;
  providerLabel: string;
  externalMeetingId: string | null;
  externalMeetingUuid: string | null;
  joinUrl: string | null;
  state: string;
  apiIntegrationStatus: string;
  apiError: string | null;
  // 接触履歴情報
  contactHistory: {
    id: number;
    title: string | null;
    scheduledStartAt: Date;
    note: string | null;
    meetingMinutes: string | null;
    status: string;
    customerParticipants: {
      id: number;
      targetType: string;
      targetId: number | null;
      companyName: string | null;
      attendees: { id: number; name: string; title: string | null }[];
    }[];
    staffParticipants: {
      id: number;
      staffId: number;
      staffName: string;
      isHost: boolean;
    }[];
    contactMethod: string | null;
    contactCategory: string | null;
  };
  host: { id: number; name: string } | null;
  // レコード
  record: {
    downloadStatus: string;
    downloadError: string | null;
    recordingStartAt: Date | null;
    recordingEndAt: Date | null;
    recordingPath: string | null;
    recordingSizeBytes: string | null; // BigInt を文字列化
    transcriptText: string | null;
    chatLogText: string | null;
    attendanceJson: unknown;
    aiSummary: string | null;
    aiSummarySource: string | null;
    aiSummaryModel: string | null;
    aiSummaryGeneratedAt: Date | null;
  };
  summaries: {
    id: number;
    version: number;
    source: string;
    model: string | null;
    generatedAt: Date;
    isCurrent: boolean;
    summaryText: string;
  }[];
};

export async function getMeetingRecordDetail(
  recordId: number,
  projectCode: "stp" | "slp" | "hojo",
): Promise<MeetingRecordDetail | null> {
  const project = await prisma.masterProject.findFirst({
    where: { code: projectCode },
    select: { id: true },
  });
  if (!project) return null;

  const record = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { id: recordId },
    include: {
      meeting: {
        include: {
          hostStaff: { select: { id: true, name: true } },
          contactHistory: {
            include: {
              contactMethod: { select: { name: true } },
              contactCategory: { select: { name: true } },
              customerParticipants: {
                orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                include: {
                  attendees: {
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
              staffParticipants: {
                include: { staff: { select: { id: true, name: true } } },
              },
              project: { select: { code: true } },
            },
          },
        },
      },
      summaries: {
        orderBy: { version: "asc" },
      },
    },
  });
  if (!record) return null;
  if (record.meeting.contactHistory.projectId !== project.id) return null;

  // 顧客名 batch
  const nameMap = await enrichCustomerLabels(
    record.meeting.contactHistory.customerParticipants.map((cp) => ({
      id: cp.id,
      targetType: cp.targetType,
      targetId: cp.targetId,
    })),
  );

  return {
    recordId: record.id,
    meetingId: record.meeting.id,
    contactHistoryId: record.meeting.contactHistoryId,
    projectCode: record.meeting.contactHistory.project.code,
    provider: record.meeting.provider,
    providerLabel: providerLabel(record.meeting.provider),
    externalMeetingId: record.meeting.externalMeetingId,
    externalMeetingUuid: record.meeting.externalMeetingUuid,
    joinUrl: record.meeting.joinUrl,
    state: record.meeting.state,
    apiIntegrationStatus: record.meeting.apiIntegrationStatus,
    apiError: record.meeting.apiError,
    contactHistory: {
      id: record.meeting.contactHistory.id,
      title: record.meeting.contactHistory.title,
      scheduledStartAt: record.meeting.contactHistory.scheduledStartAt,
      note: record.meeting.contactHistory.note,
      meetingMinutes: record.meeting.contactHistory.meetingMinutes,
      status: record.meeting.contactHistory.status,
      customerParticipants: record.meeting.contactHistory.customerParticipants.map(
        (cp) => ({
          id: cp.id,
          targetType: cp.targetType,
          targetId: cp.targetId,
          companyName: nameMap[cp.id] ?? getTargetTypeLabel(cp.targetType),
          attendees: cp.attendees.map((a) => ({
            id: a.id,
            name: a.name,
            title: a.title,
          })),
        }),
      ),
      staffParticipants: record.meeting.contactHistory.staffParticipants.map(
        (sp) => ({
          id: sp.id,
          staffId: sp.staffId,
          staffName: sp.staff.name,
          isHost: sp.isHost,
        }),
      ),
      contactMethod: record.meeting.contactHistory.contactMethod?.name ?? null,
      contactCategory:
        record.meeting.contactHistory.contactCategory?.name ?? null,
    },
    host: record.meeting.hostStaff
      ? { id: record.meeting.hostStaff.id, name: record.meeting.hostStaff.name }
      : null,
    record: {
      downloadStatus: record.downloadStatus,
      downloadError: record.downloadError,
      recordingStartAt: record.recordingStartAt,
      recordingEndAt: record.recordingEndAt,
      recordingPath: record.recordingPath,
      recordingSizeBytes:
        record.recordingSizeBytes !== null
          ? record.recordingSizeBytes.toString()
          : null,
      transcriptText: record.transcriptText,
      chatLogText: record.chatLogText,
      attendanceJson: record.attendanceJson,
      aiSummary: record.aiSummary,
      aiSummarySource: record.aiSummarySource,
      aiSummaryModel: record.aiSummaryModel,
      aiSummaryGeneratedAt: record.aiSummaryGeneratedAt,
    },
    summaries: record.summaries.map((s) => ({
      id: s.id,
      version: s.version,
      source: s.source,
      model: s.model,
      generatedAt: s.generatedAt,
      isCurrent: s.isCurrent,
      summaryText: s.summaryText,
    })),
  };
}
