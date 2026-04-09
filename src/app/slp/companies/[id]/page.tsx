import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CompanyDetail } from "./company-detail";

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
            lineFriend: { select: { id: true, snsname: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        briefingStaffUser: { select: { id: true, name: true } },
        salesStaff: { select: { id: true, name: true } },
        asStaff: { select: { id: true, name: true } },
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
    referrerText: record.referrerText,
    salesStaffId: record.salesStaffId,
    salesStaffName: record.salesStaff?.name ?? null,
    asStaffId: record.asStaffId,
    asStaffName: record.asStaff?.name ?? null,
    status1Id: record.status1Id,
    status1Name: record.status1?.name ?? null,
    status2Id: record.status2Id,
    status2Name: record.status2?.name ?? null,
    lastContactDate: toDateString(record.lastContactDate),
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

  return (
    <CompanyDetail
      record={data}
      lineFriendOptions={lineFriendOptions}
      staffOptions={staffOptions}
      industryOptions={industries}
      flowSourceOptions={flowSources}
      status1Options={status1List}
      status2Options={status2List}
    />
  );
}
