import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { CompanyRecordsTable } from "./company-records-table";
import {
  resolveCompaniesData,
  type ContactForResolution,
} from "@/lib/slp/company-resolution";

// JST(UTC+9)の日付・時刻文字列を返す
function toJstDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function toJstTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(11, 16);
}
function toJstDisplay(d: Date | null | undefined): string | null {
  const date = toJstDate(d);
  const time = toJstTime(d);
  if (!date) return null;
  return `${date} ${time ?? ""}`.trim();
}

// 今日のJST日付文字列 "YYYY-MM-DD"
function getTodayJstString(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export default async function SlpCompaniesPage() {
  const session = await auth();
  const currentStaffId = (session?.user as { id?: number | string } | undefined)?.id;
  const currentStaffIdNum =
    typeof currentStaffId === "string"
      ? parseInt(currentStaffId, 10)
      : (currentStaffId ?? null);

  const todayJst = getTodayJstString();
  // 一覧ページでは「パッと見る」のに必要な項目に加え、
  // AS担当・紹介者・代理店の自動解決に必要な担当者・LINE情報も取得する。
  const records = await prisma.slpCompanyRecord.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      businessType: true,
      briefingStatus: true,
      briefingDate: true,
      briefingStaffId: true,
      consultationStatus: true,
      consultationDate: true,
      consultationStaffId: true,
      salesStaff: { select: { id: true, name: true } },
      status1: { select: { id: true, name: true } },
      status2: { select: { id: true, name: true } },
      contacts: {
        select: {
          id: true,
          name: true,
          lineFriendId: true,
          manualAsId: true,
          manualAsReason: true,
          manualAsChangedAt: true,
          manualAsChangedBy: { select: { name: true } },
          manualAs: { select: { id: true, name: true } },
          lineFriend: {
            select: {
              id: true,
              uid: true,
              snsname: true,
              free1: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
    orderBy: { id: "asc" },
  });

  // 解決ロジックに渡す形に整形
  const companiesForResolution = records.map((r) => ({
    id: r.id,
    contacts: r.contacts.map<ContactForResolution>((c) => ({
      id: c.id,
      name: c.name,
      lineFriendId: c.lineFriendId,
      manualAsId: c.manualAsId,
      manualAsReason: c.manualAsReason,
      manualAsChangedAt: c.manualAsChangedAt,
      manualAsChangedByName: c.manualAsChangedBy?.name ?? null,
      manualAs: c.manualAs,
      lineFriend: c.lineFriend,
    })),
  }));

  const resolutionMap = await resolveCompaniesData(companiesForResolution);

  const data = records.map((r) => {
    const resolution = resolutionMap.get(r.id);
    // 主担当（または最初の担当者）のLINE友達情報を「{LINE_id} {snsname}」の形で抽出
    // → 企業名未登録時に「何から作成されたレコードか」を識別するために使う
    const primaryContact =
      r.contacts.find((c) => c.lineFriend) ?? null;
    const primaryContactLineLabel = primaryContact?.lineFriend
      ? `${primaryContact.lineFriend.id} ${primaryContact.lineFriend.snsname ?? ""}`.trim()
      : null;

    // 商談バッジ用の事前計算
    const briefingDateOnly = toJstDate(r.briefingDate);
    const consultationDateOnly = toJstDate(r.consultationDate);
    // 今日商談あり (概要案内 or 導入希望商談 のどちらか・種別不問)
    const briefingIsToday =
      briefingDateOnly === todayJst && r.briefingStatus !== "完了" && r.briefingStatus !== "キャンセル";
    const consultationIsToday =
      consultationDateOnly === todayJst &&
      r.consultationStatus !== "完了" &&
      r.consultationStatus !== "キャンセル";
    const hasMeetingToday = briefingIsToday || consultationIsToday;
    // 自分が今日の担当か（current staffId === briefing/consultation staffId）
    const assignedToCurrentUserToday =
      currentStaffIdNum !== null &&
      ((briefingIsToday && r.briefingStaffId === currentStaffIdNum) ||
        (consultationIsToday && r.consultationStaffId === currentStaffIdNum));
    // 過去の商談日が「完了」になっていない（昨日以前）
    const hasOverdueBriefing =
      briefingDateOnly !== null &&
      briefingDateOnly < todayJst &&
      r.briefingStatus !== "完了" &&
      r.briefingStatus !== "キャンセル";
    const hasOverdueConsultation =
      consultationDateOnly !== null &&
      consultationDateOnly < todayJst &&
      r.consultationStatus !== "完了" &&
      r.consultationStatus !== "キャンセル";
    const hasOverdueUnfinished = hasOverdueBriefing || hasOverdueConsultation;

    return {
      id: r.id,
      companyNo: r.id,
      companyName: r.companyName,
      businessType: r.businessType,
      primaryContactLineLabel,
      briefingStatus: r.briefingStatus,
      briefingDate: toJstDisplay(r.briefingDate),
      briefingDateOnly,
      consultationStatus: r.consultationStatus,
      consultationDate: toJstDisplay(r.consultationDate),
      consultationDateOnly,
      hasMeetingToday,
      assignedToCurrentUserToday,
      hasOverdueUnfinished,
      salesStaffName: r.salesStaff?.name ?? null,
      status1Name: r.status1?.name ?? null,
      status2Name: r.status2?.name ?? null,
      asEntries:
        resolution?.aggregated.as.map((a) => ({
          label: a.label,
          contacts: a.contacts,
          isManual: a.isManual,
          manualAsReason: a.manualAsReason,
          autoAsName: a.autoAsName,
        })) ?? [],
      referrerEntries:
        resolution?.aggregated.referrer.map((r) => ({
          label: r.label,
          contacts: r.contacts,
        })) ?? [],
      agencyEntries:
        resolution?.aggregated.agency.map((a) => ({
          label: a.label,
          contacts: a.contacts,
        })) ?? [],
      multipleAgencyWarnings:
        resolution?.aggregated.multipleAgencyWarnings ?? [],
    };
  });

  // 重複候補リストを取得
  const duplicateCandidates =
    await prisma.slpCompanyDuplicateCandidate.findMany({
      include: {
        recordA: {
          select: {
            id: true,
            companyName: true,
            companyPhone: true,
            prefecture: true,
            address: true,
            briefingStatus: true,
          },
        },
        recordB: {
          select: {
            id: true,
            companyName: true,
            companyPhone: true,
            prefecture: true,
            address: true,
            briefingStatus: true,
          },
        },
      },
      orderBy: { detectedAt: "desc" },
    });

  const duplicateCandidatesData = duplicateCandidates.map((c) => ({
    id: c.id,
    reasons: c.reasons,
    detectedAt: c.detectedAt.toISOString(),
    recordA: {
      id: c.recordA.id,
      companyName: c.recordA.companyName,
      companyPhone: c.recordA.companyPhone,
      address: [c.recordA.prefecture, c.recordA.address]
        .filter(Boolean)
        .join(""),
      briefingStatus: c.recordA.briefingStatus,
    },
    recordB: {
      id: c.recordB.id,
      companyName: c.recordB.companyName,
      companyPhone: c.recordB.companyPhone,
      address: [c.recordB.prefecture, c.recordB.address]
        .filter(Boolean)
        .join(""),
      briefingStatus: c.recordB.briefingStatus,
    },
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">事業者名簿</h1>
      <CompanyRecordsTable
        data={data}
        duplicateCandidates={duplicateCandidatesData}
      />
    </div>
  );
}
