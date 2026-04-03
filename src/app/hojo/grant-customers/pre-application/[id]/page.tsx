import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { PreApplicationDetail } from "./pre-application-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PreApplicationDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [record, vendors] = await Promise.all([
    prisma.hojoGrantCustomerPreApplication.findFirst({
      where: { id, deletedAt: null },
      include: { vendor: { select: { id: true, name: true } } },
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!record) notFound();

  const vendorOptions = vendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  // Serialize all fields
  const toStr = (v: unknown) => (v != null ? String(v) : "");
  const toDateStr = (v: Date | null | undefined) =>
    v ? v.toISOString().split("T")[0] : "";
  const toNum = (v: unknown) => (v != null ? String(v) : "");

  const data = {
    id: record.id,
    vendorId: String(record.vendorId),
    vendorName: record.vendor.name,
    isBpo: record.isBpo,
    applicantName: toStr(record.applicantName),
    referrer: toStr(record.referrer),
    salesStaff: toStr(record.salesStaff),
    category: toStr(record.category),
    status: toStr(record.status),
    prospectLevel: toStr(record.prospectLevel),
    phone: toStr(record.phone),
    businessEntity: toStr(record.businessEntity),
    industry: toStr(record.industry),
    detailMemo: toStr(record.detailMemo),
    nextAction: toStr(record.nextAction),
    nextContactDate: toDateStr(record.nextContactDate),
    overviewBriefingDate: toDateStr(record.overviewBriefingDate),
    mtgRecordingUrl: toStr(record.mtgRecordingUrl),
    briefingStaff: toStr(record.briefingStaff),
    systemType: toStr(record.systemType),
    hasLoan: toStr(record.hasLoan),
    revenueRange: toStr(record.revenueRange),
    importantTags: toStr(record.importantTags),
    loanPattern: toStr(record.loanPattern),
    referrerRewardPct: toNum(record.referrerRewardPct),
    agent1Number: toStr(record.agent1Number),
    agent1RewardPct: toNum(record.agent1RewardPct),
    totalReward: toNum(record.totalReward),
    doubleChecker: toStr(record.doubleChecker),
    repeatJudgment: toStr(record.repeatJudgment),
    wageRaiseEligible: toStr(record.wageRaiseEligible),
    pastProduct: toStr(record.pastProduct),
    lostDate: toDateStr(record.lostDate),
    agentContractUrl: toStr(record.agentContractUrl),
    docCollectionStart: toDateStr(record.docCollectionStart),
    docSubmissionDate: toDateStr(record.docSubmissionDate),
    businessName: toStr(record.businessName),
    doc1: toStr(record.doc1),
    doc2: toStr(record.doc2),
    doc3: toStr(record.doc3),
    doc4: toStr(record.doc4),
    doc5: toStr(record.doc5),
    itStrategyNaviPdf: toStr(record.itStrategyNaviPdf),
    hasEmployees: toStr(record.hasEmployees),
    gbizidScreenshot: toStr(record.gbizidScreenshot),
    gbizidAddress: toStr(record.gbizidAddress),
    selfDeclarationId: toStr(record.selfDeclarationId),
    antiSocialCheck: toStr(record.antiSocialCheck),
    establishmentDate: toDateStr(record.establishmentDate),
    capital: toStr(record.capital),
    fiscalMonth: toStr(record.fiscalMonth),
    revenue: toNum(record.revenue),
    grossProfit: toNum(record.grossProfit),
    operatingProfit: toNum(record.operatingProfit),
    ordinaryProfit: toNum(record.ordinaryProfit),
    depreciation: toNum(record.depreciation),
    laborCost: toNum(record.laborCost),
    capitalOrReserve: toStr(record.capitalOrReserve),
    executiveCompensation: toNum(record.executiveCompensation),
    totalSalaryPrevYear: toNum(record.totalSalaryPrevYear),
    planYear1: toStr(record.planYear1),
    planYear2: toStr(record.planYear2),
    planYear3: toStr(record.planYear3),
    bonus1Target: toStr(record.bonus1Target),
    bonus1Doc: toStr(record.bonus1Doc),
    bonus2Target: toStr(record.bonus2Target),
    bonus2Doc: toStr(record.bonus2Doc),
    minWage: toStr(record.minWage),
    applicationSystem: toStr(record.applicationSystem),
    businessDescriptionDraft: toStr(record.businessDescriptionDraft),
    businessProcessNote: toStr(record.businessProcessNote),
    homepageUrl: toStr(record.homepageUrl),
    businessDescription: toStr(record.businessDescription),
    challengeTitle: toStr(record.challengeTitle),
    challengeGoal: toStr(record.challengeGoal),
    growthMatchingDescription: toStr(record.growthMatchingDescription),
    dataEntryStaff: toStr(record.dataEntryStaff),
    dataEntryConfirmed: toStr(record.dataEntryConfirmed),
    businessDescriptionFinal: toStr(record.businessDescriptionFinal),
    industryCode: toStr(record.industryCode),
    officeCount: toNum(record.officeCount),
    empRegular: toNum(record.empRegular),
    empContract: toNum(record.empContract),
    empPartTime: toNum(record.empPartTime),
    empDispatch: toNum(record.empDispatch),
    empOther: toNum(record.empOther),
    wageTable1: toStr(record.wageTable1),
    wageTable2: toStr(record.wageTable2),
    wageTable3: toStr(record.wageTable3),
    wageTable4: toStr(record.wageTable4),
    wageTable5: toStr(record.wageTable5),
    wageTable6: toStr(record.wageTable6),
    wageTable7: toStr(record.wageTable7),
    wageTable8: toStr(record.wageTable8),
    wageTable9: toStr(record.wageTable9),
    wageTable10: toStr(record.wageTable10),
  };

  return (
    <PreApplicationDetail
      data={data}
      canEdit={canEdit}
      vendorOptions={vendorOptions}
    />
  );
}
