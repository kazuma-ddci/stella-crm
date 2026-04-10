import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CompanyDetail } from "./company-detail";
import {
  resolveCompanyData,
  type ContactForResolution,
} from "@/lib/slp/company-resolution";

// 今日のJST日付文字列
function getTodayJstString(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

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
function toDateString(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}
function toDecimalString(d: { toString: () => string } | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return d.toString();
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SlpCompanyDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const currentStaffId = (session?.user as { id?: number | string } | undefined)?.id;
  const currentStaffIdNum =
    typeof currentStaffId === "string"
      ? parseInt(currentStaffId, 10)
      : (currentStaffId ?? null);
  const todayJst = getTodayJstString();

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [
    record,
    lineFriends,
    slpStaffPermissions,
    industries,
    flowSources,
    status1List,
    status2List,
  ] = await Promise.all([
    prisma.slpCompanyRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: {
          include: {
            lineFriend: {
              select: { id: true, snsname: true, uid: true, free1: true },
            },
            manualAs: { select: { id: true, name: true } },
            manualAsChangedBy: { select: { name: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        briefingStaffUser: { select: { id: true, name: true } },
        consultationStaffUser: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
        industry: { select: { id: true, name: true } },
        flowSource: { select: { id: true, name: true } },
        status1: { select: { id: true, name: true } },
        status2: { select: { id: true, name: true } },
        statusHistories: {
          include: { changedBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
        submittedDocuments: {
          where: { deletedAt: null },
          orderBy: [
            { category: "asc" },
            { documentType: "asc" },
            { fiscalPeriod: "asc" },
            { createdAt: "desc" },
          ],
        },
        // 予約履歴（新しい順）
        reservationHistories: {
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, snsname: true, uid: true },
      orderBy: { id: "asc" },
    }),
    slpProject
      ? prisma.staffPermission.findMany({
          where: {
            projectId: slpProject.id,
            permissionLevel: { in: ["view", "edit", "manager"] },
          },
          select: {
            staff: {
              select: { id: true, name: true, isActive: true, isSystemUser: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.slpIndustryMaster.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.slpFlowSourceMaster.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.slpCompanyStatus1Master.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.slpCompanyStatus2Master.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!record) notFound();

  // この企業の重複候補を取得
  const duplicateCandidates = await prisma.slpCompanyDuplicateCandidate.findMany({
    where: {
      OR: [{ recordIdA: id }, { recordIdB: id }],
    },
    include: {
      recordA: { select: { id: true, companyName: true } },
      recordB: { select: { id: true, companyName: true } },
    },
  });
  const duplicateCandidatesData = duplicateCandidates.map((c) => {
    const other = c.recordIdA === id ? c.recordB : c.recordA;
    return {
      candidateId: c.id,
      otherRecordId: other.id,
      otherCompanyName: other.companyName,
      reasons: c.reasons,
    };
  });

  // SlpAs一覧（手動上書き選択肢用）
  const asOptions = await prisma.slpAs.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  // AS担当・紹介者・代理店の自動解決
  const resolution = await resolveCompanyData(
    record.contacts.map<ContactForResolution>((c) => ({
      id: c.id,
      name: c.name,
      lineFriendId: c.lineFriendId,
      manualAsId: c.manualAsId,
      manualAsReason: c.manualAsReason,
      manualAsChangedAt: c.manualAsChangedAt,
      manualAsChangedByName: c.manualAsChangedBy?.name ?? null,
      manualAs: c.manualAs,
      lineFriend: c.lineFriend,
    }))
  );

  const data = {
    id: record.id,
    companyNo: record.id,
    contacts: record.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      email: c.email,
      phone: c.phone,
      lineFriendId: c.lineFriendId,
      lineFriendLabel: c.lineFriend
        ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
        : null,
      isPrimary: c.isPrimary,
    })),
    // 概要案内
    briefingStatus: record.briefingStatus,
    briefingBookedAt: toJstDisplay(record.briefingBookedAt),
    briefingBookedDate: toJstDate(record.briefingBookedAt),
    briefingBookedTime: toJstTime(record.briefingBookedAt),
    briefingDate: toJstDisplay(record.briefingDate),
    briefingDateOnly: toJstDate(record.briefingDate),
    briefingTimeOnly: toJstTime(record.briefingDate),
    briefingStaff: record.briefingStaff,
    briefingStaffId: record.briefingStaffId,
    briefingStaffName: record.briefingStaffUser?.name ?? null,
    briefingChangedAt: toJstDisplay(record.briefingChangedAt),
    briefingCanceledAt: toJstDisplay(record.briefingCanceledAt),
    // 導入希望商談
    consultationStatus: record.consultationStatus,
    consultationBookedAt: toJstDisplay(record.consultationBookedAt),
    consultationBookedDate: toJstDate(record.consultationBookedAt),
    consultationBookedTime: toJstTime(record.consultationBookedAt),
    consultationDate: toJstDisplay(record.consultationDate),
    consultationDateOnly: toJstDate(record.consultationDate),
    consultationTimeOnly: toJstTime(record.consultationDate),
    consultationStaff: record.consultationStaff,
    consultationStaffId: record.consultationStaffId,
    consultationStaffName: record.consultationStaffUser?.name ?? null,
    consultationChangedAt: toJstDisplay(record.consultationChangedAt),
    consultationCanceledAt: toJstDisplay(record.consultationCanceledAt),
    // 予約ID（メイン + マージで取り込まれた配列）
    reservationId: record.reservationId,
    consultationReservationId: record.consultationReservationId,
    mergedBriefingReservationIds: record.mergedBriefingReservationIds,
    mergedConsultationReservationIds: record.mergedConsultationReservationIds,
    // 予約履歴（概要案内・導入希望商談 共通テーブル、新しい順）
    reservationHistories: record.reservationHistories.map((h) => ({
      id: h.id,
      reservationType: h.reservationType,
      actionType: h.actionType,
      reservationId: h.reservationId,
      reservedAt: toJstDisplay(h.reservedAt),
      bookedAt: toJstDisplay(h.bookedAt),
      staffName: h.staffName,
      formAnswers: h.formAnswers as Record<string, string | null> | null,
      createdAt: toJstDisplay(h.createdAt),
    })),
    // 商談バッジ用フラグ
    hasMeetingToday: (() => {
      const briefingDateOnly = toJstDate(record.briefingDate);
      const consultationDateOnly = toJstDate(record.consultationDate);
      const briefingIsToday =
        briefingDateOnly === todayJst &&
        record.briefingStatus !== "完了" &&
        record.briefingStatus !== "キャンセル";
      const consultationIsToday =
        consultationDateOnly === todayJst &&
        record.consultationStatus !== "完了" &&
        record.consultationStatus !== "キャンセル";
      return briefingIsToday || consultationIsToday;
    })(),
    assignedToCurrentUserToday: (() => {
      if (currentStaffIdNum === null) return false;
      const briefingDateOnly = toJstDate(record.briefingDate);
      const consultationDateOnly = toJstDate(record.consultationDate);
      const briefingIsTodayMine =
        briefingDateOnly === todayJst &&
        record.briefingStatus !== "完了" &&
        record.briefingStatus !== "キャンセル" &&
        record.briefingStaffId === currentStaffIdNum;
      const consultationIsTodayMine =
        consultationDateOnly === todayJst &&
        record.consultationStatus !== "完了" &&
        record.consultationStatus !== "キャンセル" &&
        record.consultationStaffId === currentStaffIdNum;
      return briefingIsTodayMine || consultationIsTodayMine;
    })(),
    hasOverdueUnfinished: (() => {
      const briefingDateOnly = toJstDate(record.briefingDate);
      const consultationDateOnly = toJstDate(record.consultationDate);
      const briefingOverdue =
        briefingDateOnly !== null &&
        briefingDateOnly < todayJst &&
        record.briefingStatus !== "完了" &&
        record.briefingStatus !== "キャンセル";
      const consultationOverdue =
        consultationDateOnly !== null &&
        consultationDateOnly < todayJst &&
        record.consultationStatus !== "完了" &&
        record.consultationStatus !== "キャンセル";
      return briefingOverdue || consultationOverdue;
    })(),
    // 基本情報
    companyName: record.companyName,
    representativeName: record.representativeName,
    employeeCount: record.employeeCount,
    prefecture: record.prefecture,
    address: record.address,
    companyPhone: record.companyPhone,
    pensionOffice: record.pensionOffice,
    pensionOfficerName: record.pensionOfficerName,
    industryId: record.industryId,
    industryName: record.industry?.name ?? null,
    flowSourceId: record.flowSourceId,
    flowSourceName: record.flowSource?.name ?? null,
    salesStaffId: record.salesStaffId,
    salesStaffName: record.salesStaff?.name ?? null,
    status1Id: record.status1Id,
    status1Name: record.status1?.name ?? null,
    status2Id: record.status2Id,
    status2Name: record.status2?.name ?? null,
    lastContactDate: toDateString(record.lastContactDate),
    annualLaborCostExecutive: toDecimalString(record.annualLaborCostExecutive),
    annualLaborCostEmployee: toDecimalString(record.annualLaborCostEmployee),
    averageMonthlySalary: toDecimalString(record.averageMonthlySalary),
    // プロライン予約フォーム回答（生テキスト・サジェスト表示用）
    annualLaborCostExecutiveFormAnswer: record.annualLaborCostExecutiveFormAnswer,
    annualLaborCostEmployeeFormAnswer: record.annualLaborCostEmployeeFormAnswer,
    employeeCountFormAnswer: record.employeeCountFormAnswer,
    // 金額・契約情報
    initialFee: toDecimalString(record.initialFee),
    initialPeopleCount: record.initialPeopleCount,
    monthlyFee: toDecimalString(record.monthlyFee),
    monthlyPeopleCount: record.monthlyPeopleCount,
    contractDate: toDateString(record.contractDate),
    lastPaymentDate: toDateString(record.lastPaymentDate),
    invoiceSentDate: toDateString(record.invoiceSentDate),
    nextPaymentDate: toDateString(record.nextPaymentDate),
    estMaxRefundPeople: record.estMaxRefundPeople,
    estMaxRefundAmount: toDecimalString(record.estMaxRefundAmount),
    estOurRevenue: toDecimalString(record.estOurRevenue),
    estAgentPayment: toDecimalString(record.estAgentPayment),
    confirmedRefundPeople: record.confirmedRefundPeople,
    confirmedRefundAmount: toDecimalString(record.confirmedRefundAmount),
    confirmedOurRevenue: toDecimalString(record.confirmedOurRevenue),
    confirmedAgentPayment: toDecimalString(record.confirmedAgentPayment),
    paymentReceivedDate: toDateString(record.paymentReceivedDate),
    statusHistories: record.statusHistories.map((h) => ({
      id: h.id,
      flow: h.flow,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      changedByName: h.changedBy?.name ?? null,
      createdAt: toJstDisplay(h.createdAt),
    })),
    submittedDocuments: record.submittedDocuments.map((d) => ({
      id: d.id,
      category: d.category,
      documentType: d.documentType,
      fiscalPeriod: d.fiscalPeriod,
      fileName: d.fileName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      uploadedByUid: d.uploadedByUid,
      uploadedByName: d.uploadedByName,
      isCurrent: d.isCurrent,
      createdAt: d.createdAt.toISOString(),
    })),
  };

  const lineFriendOptions = lineFriends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname ?? ""}`.trim(),
  }));

  const staffOptions = slpStaffPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  // 解決結果を JSON-friendly な形に変換（Date を ISO に）
  const asResolutions = resolution.perContact.as.map((a) => ({
    contactId: a.contactId,
    contactName: a.contactName,
    contactDisplay: a.contactDisplay,
    autoAsId: a.autoAsId,
    autoAsName: a.autoAsName,
    manualAsId: a.manualAsId,
    manualAsName: a.manualAsName,
    manualAsReason: a.manualAsReason,
    manualAsChangedAt: a.manualAsChangedAt
      ? a.manualAsChangedAt.toISOString()
      : null,
    manualAsChangedByName: a.manualAsChangedByName,
    effectiveAsId: a.effectiveAsId,
    effectiveAsName: a.effectiveAsName,
    isManual: a.isManual,
  }));

  const referrerResolutions = resolution.perContact.referrer.map((r) => ({
    contactId: r.contactId,
    contactName: r.contactName,
    contactDisplay: r.contactDisplay,
    referrers: r.referrers,
  }));

  const agencyResolutions = resolution.perContact.agency.map((a) => ({
    contactId: a.contactId,
    contactName: a.contactName,
    contactDisplay: a.contactDisplay,
    agencies: a.agencies,
  }));

  return (
    <CompanyDetail
      record={data}
      lineFriendOptions={lineFriendOptions}
      staffOptions={staffOptions}
      industryOptions={industries}
      flowSourceOptions={flowSources}
      status1Options={status1List}
      status2Options={status2List}
      asOptions={asOptions}
      asResolutions={asResolutions}
      referrerResolutions={referrerResolutions}
      agencyResolutions={agencyResolutions}
      multipleAgencyWarnings={resolution.aggregated.multipleAgencyWarnings}
      duplicateCandidates={duplicateCandidatesData}
    />
  );
}
