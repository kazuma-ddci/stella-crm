import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { MergeClient } from "./merge-client";

function toDateString(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}
function toDecimalString(
  d: { toString: () => string } | null | undefined
): string {
  if (d === null || d === undefined) return "";
  return d.toString();
}

type Props = {
  searchParams: Promise<{ a?: string; b?: string }>;
};

export default async function SlpCompanyMergePage({ searchParams }: Props) {
  const { a, b } = await searchParams;
  const aId = parseInt(a ?? "", 10);
  const bId = parseInt(b ?? "", 10);
  if (isNaN(aId) || isNaN(bId) || aId === bId) notFound();

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [
    recordA,
    recordB,
    industries,
    flowSources,
    status1List,
    status2List,
    slpStaffAssignments,
  ] = await Promise.all([
    prisma.slpCompanyRecord.findFirst({
      where: { id: aId, deletedAt: null },
      include: {
        contacts: { select: { id: true } },
        statusHistories: { select: { id: true } },
        submittedDocuments: { select: { id: true }, where: { deletedAt: null } },
      },
    }),
    prisma.slpCompanyRecord.findFirst({
      where: { id: bId, deletedAt: null },
      include: {
        contacts: { select: { id: true } },
        statusHistories: { select: { id: true } },
        submittedDocuments: { select: { id: true }, where: { deletedAt: null } },
      },
    }),
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
    slpProject
      ? prisma.staffProjectAssignment.findMany({
          where: { projectId: slpProject.id },
          select: {
            staff: {
              select: {
                id: true,
                name: true,
                isActive: true,
                isSystemUser: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  if (!recordA || !recordB) notFound();

  const toData = (r: typeof recordA) => ({
    id: r.id,
    companyName: r.companyName,
    representativeName: r.representativeName,
    employeeCount: r.employeeCount !== null ? String(r.employeeCount) : "",
    prefecture: r.prefecture,
    address: r.address,
    companyPhone: r.companyPhone,
    pensionOffice: r.pensionOffice,
    pensionOfficerName: r.pensionOfficerName,
    industryId: r.industryId,
    flowSourceId: r.flowSourceId,
    salesStaffId: r.salesStaffId,
    status1Id: r.status1Id,
    status2Id: r.status2Id,
    lastContactDate: toDateString(r.lastContactDate),
    annualLaborCostExecutive: toDecimalString(r.annualLaborCostExecutive),
    annualLaborCostEmployee: toDecimalString(r.annualLaborCostEmployee),
    averageMonthlySalary: toDecimalString(r.averageMonthlySalary),
    initialFee: toDecimalString(r.initialFee),
    initialPeopleCount:
      r.initialPeopleCount !== null ? String(r.initialPeopleCount) : "",
    monthlyFee: toDecimalString(r.monthlyFee),
    monthlyPeopleCount:
      r.monthlyPeopleCount !== null ? String(r.monthlyPeopleCount) : "",
    contractDate: toDateString(r.contractDate),
    lastPaymentDate: toDateString(r.lastPaymentDate),
    invoiceSentDate: toDateString(r.invoiceSentDate),
    nextPaymentDate: toDateString(r.nextPaymentDate),
    estMaxRefundPeople:
      r.estMaxRefundPeople !== null ? String(r.estMaxRefundPeople) : "",
    estMaxRefundAmount: toDecimalString(r.estMaxRefundAmount),
    estOurRevenue: toDecimalString(r.estOurRevenue),
    estAgentPayment: toDecimalString(r.estAgentPayment),
    confirmedRefundPeople:
      r.confirmedRefundPeople !== null ? String(r.confirmedRefundPeople) : "",
    confirmedRefundAmount: toDecimalString(r.confirmedRefundAmount),
    confirmedOurRevenue: toDecimalString(r.confirmedOurRevenue),
    confirmedAgentPayment: toDecimalString(r.confirmedAgentPayment),
    paymentReceivedDate: toDateString(r.paymentReceivedDate),
    contactCount: r.contacts.length,
    historyCount: r.statusHistories.length,
    documentCount: r.submittedDocuments.length,
  });

  const staffOptions = slpStaffAssignments
    .filter((a) => a.staff.isActive && !a.staff.isSystemUser)
    .map((a) => ({ id: a.staff.id, name: a.staff.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業の重複統合</h1>
      <MergeClient
        recordA={toData(recordA)}
        recordB={toData(recordB)}
        industryOptions={industries}
        flowSourceOptions={flowSources}
        status1Options={status1List}
        status2Options={status2List}
        staffOptions={staffOptions}
      />
    </div>
  );
}
