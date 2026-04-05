"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import bcrypt from "bcryptjs";

async function isStaffWithHojoEdit(): Promise<boolean> {
  const session = await auth();
  const userType = session?.user?.userType;
  if (userType !== "staff") return false;
  const permissions = (session?.user?.permissions ?? []) as UserPermission[];
  return canEditProject(permissions, "hojo");
}

export async function registerVendorAccount(data: {
  name: string;
  email: string;
  password: string;
  vendorToken: string;
}) {
  const { name, email, password, vendorToken } = data;

  if (!name.trim() || !email.trim() || !password.trim()) {
    throw new Error("すべての項目を入力してください");
  }
  if (password.length < 8) {
    throw new Error("パスワードは8文字以上にしてください");
  }

  // トークンからベンダーを特定
  const vendor = await prisma.hojoVendor.findUnique({
    where: { accessToken: vendorToken },
  });
  if (!vendor || !vendor.isActive) {
    throw new Error("無効なURLです");
  }

  // メールアドレスの重複チェック
  const existingVendor = await prisma.hojoVendorAccount.findUnique({ where: { email: email.trim() } });
  if (existingVendor) throw new Error("このメールアドレスは既に登録されています");
  const existingBbs = await prisma.hojoBbsAccount.findUnique({ where: { email: email.trim() } });
  if (existingBbs) throw new Error("このメールアドレスは既に使用されています");
  const existingStaff = await prisma.masterStaff.findUnique({ where: { email: email.trim() } });
  if (existingStaff) throw new Error("このメールアドレスは既に使用されています");

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.hojoVendorAccount.create({
    data: {
      vendorId: vendor.id,
      name: name.trim(),
      email: email.trim(),
      passwordHash,
    },
  });
}

export async function recordVendorPasswordResetRequest(email: string) {
  const account = await prisma.hojoVendorAccount.findUnique({ where: { email } });
  if (account) {
    await prisma.hojoVendorAccount.update({
      where: { id: account.id },
      data: { passwordResetRequestedAt: new Date() },
    });
  }
}

export async function updateVendorFields(
  applicationSupportId: number,
  vendorId: number,
  data: { subsidyDesiredDate?: string | null; subsidyAmount?: number | null; vendorMemo?: string | null }
) {
  const staffEdit = await isStaffWithHojoEdit();
  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: applicationSupportId },
  });
  if (!record || record.deletedAt) {
    throw new Error("レコードが見つかりません");
  }
  // スタッフはvendorId制約なし、ベンダーは自分のレコードのみ
  if (!staffEdit && record.vendorId !== vendorId) {
    throw new Error("レコードが見つかりません");
  }

  const updateData: Record<string, unknown> = {};
  if (data.subsidyDesiredDate !== undefined) {
    updateData.subsidyDesiredDate = data.subsidyDesiredDate ? new Date(data.subsidyDesiredDate) : null;
  }
  if (data.subsidyAmount !== undefined) {
    updateData.subsidyAmount = data.subsidyAmount ?? null;
  }
  if (data.vendorMemo !== undefined) {
    updateData.vendorMemo = data.vendorMemo?.trim() || null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationSupport.update({
      where: { id: applicationSupportId },
      data: updateData,
    });
  }

  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/application-support");
}

export async function changeVendorPassword(accountId: number, newPassword: string) {
  if (newPassword.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.hojoVendorAccount.update({
    where: { id: accountId },
    data: { passwordHash, mustChangePassword: false },
  });
}

// ========== 卸アカウント管理 ==========

export async function addWholesaleAccount(vendorId: number, data: Record<string, unknown>) {
  const staffEdit = await isStaffWithHojoEdit();
  const session = await auth();
  const userType = session?.user?.userType;
  const sessionVendorId = session?.user?.vendorId;
  if (!staffEdit && (userType !== "vendor" || sessionVendorId !== vendorId)) {
    throw new Error("権限がありません");
  }
  await prisma.hojoWholesaleAccount.create({
    data: {
      vendorId,
      supportProviderName: data.supportProviderName ? String(data.supportProviderName).trim() : null,
      companyName: data.companyName ? String(data.companyName).trim() : null,
      email: data.email ? String(data.email).trim() : null,
      softwareSalesContractUrl: data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null,
      recruitmentRound: data.recruitmentRound ? Number(data.recruitmentRound) : null,
      adoptionDate: data.adoptionDate ? new Date(String(data.adoptionDate)) : null,
      issueRequestDate: data.issueRequestDate ? new Date(String(data.issueRequestDate)) : null,
      grantDate: data.grantDate ? new Date(String(data.grantDate)) : null,
    },
  });
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}

export async function updateWholesaleAccountByVendor(
  id: number,
  vendorId: number,
  data: Record<string, unknown>
) {
  const staffEdit = await isStaffWithHojoEdit();
  const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
  if (!record || record.deletedAt) {
    throw new Error("レコードが見つかりません");
  }
  if (!staffEdit && record.vendorId !== vendorId) {
    throw new Error("レコードが見つかりません");
  }

  const updateData: Record<string, unknown> = {};
  if (data.supportProviderName !== undefined) updateData.supportProviderName = data.supportProviderName ? String(data.supportProviderName).trim() : null;
  if (data.companyName !== undefined) updateData.companyName = data.companyName ? String(data.companyName).trim() : null;
  if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
  if (data.softwareSalesContractUrl !== undefined) updateData.softwareSalesContractUrl = data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null;
  if (data.recruitmentRound !== undefined) updateData.recruitmentRound = data.recruitmentRound ? Number(data.recruitmentRound) : null;
  const dateFields = ["adoptionDate", "issueRequestDate", "grantDate"];
  for (const field of dateFields) {
    if (data[field] !== undefined) updateData[field] = data[field] ? new Date(String(data[field])) : null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoWholesaleAccount.update({ where: { id }, data: updateData });
  }
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}

export async function updateActivityNotesByVendor(
  activityId: number,
  vendorId: number,
  notes: string
) {
  // Validate the activity belongs to this vendor
  const activity = await prisma.hojoConsultingActivity.findFirst({
    where: { id: activityId, vendorId, deletedAt: null },
  });
  if (!activity) throw new Error("アクティビティが見つかりません");

  await prisma.hojoConsultingActivity.update({
    where: { id: activityId },
    data: { notes: notes.trim() || null },
  });

  revalidatePath(`/hojo/vendor`);
}

export async function deleteWholesaleAccountByVendor(id: number, vendorId: number) {
  const staffEdit = await isStaffWithHojoEdit();
  const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
  if (!record) throw new Error("レコードが見つかりません");
  if (!staffEdit && record.vendorId !== vendorId) throw new Error("レコードが見つかりません");
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedByVendor: true },
  });
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}

// ============ 顧客管理 CRUD (ベンダー用) ============

export async function getPreApplicationDetail(id: number, vendorId: number) {
  const record = await prisma.hojoGrantCustomerPreApplication.findFirst({
    where: { id, vendorId, deletedAt: null },
  });
  if (!record) throw new Error("レコードが見つかりません");
  // Serialize dates and decimals for client
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) serialized[key] = value.toISOString().split("T")[0];
    else if (typeof value === "object" && value !== null && "toNumber" in value) serialized[key] = (value as { toNumber(): number }).toNumber();
    else serialized[key] = value;
  }
  return serialized;
}

export async function getPostApplicationDetail(id: number, vendorId: number) {
  const record = await prisma.hojoGrantCustomerPostApplication.findFirst({
    where: { id, vendorId, deletedAt: null },
  });
  if (!record) throw new Error("レコードが見つかりません");
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) serialized[key] = value.toISOString().split("T")[0];
    else if (typeof value === "object" && value !== null && "toNumber" in value) serialized[key] = (value as { toNumber(): number }).toNumber();
    else serialized[key] = value;
  }
  return serialized;
}

function toDateOrNull(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function toDecimalOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val).trim();
}

export async function addPreApplicationByVendor(vendorId: number, data: Record<string, unknown>) {
  await prisma.hojoGrantCustomerPreApplication.create({
    data: {
      vendor: { connect: { id: vendorId } },
      applicantName: toStr(data.applicantName),
      referrer: toStr(data.referrer),
      salesStaff: toStr(data.salesStaff),
      category: toStr(data.category),
      status: toStr(data.status),
      prospectLevel: toStr(data.prospectLevel),
      detailMemo: toStr(data.detailMemo),
      nextAction: toStr(data.nextAction),
      nextContactDate: toDateOrNull(data.nextContactDate),
      overviewBriefingDate: toDateOrNull(data.overviewBriefingDate),
      mtgRecordingUrl: toStr(data.mtgRecordingUrl),
      briefingStaff: toStr(data.briefingStaff),
      phone: toStr(data.phone),
      businessEntity: toStr(data.businessEntity),
      industry: toStr(data.industry),
      systemType: toStr(data.systemType),
      hasLoan: toStr(data.hasLoan),
      revenueRange: toStr(data.revenueRange),
      importantTags: toStr(data.importantTags),
      loanPattern: toStr(data.loanPattern),
      referrerRewardPct: toDecimalOrNull(data.referrerRewardPct),
      agent1Number: toStr(data.agent1Number),
      agent1RewardPct: toDecimalOrNull(data.agent1RewardPct),
      totalReward: toDecimalOrNull(data.totalReward),
      doubleChecker: toStr(data.doubleChecker),
      repeatJudgment: toStr(data.repeatJudgment),
      wageRaiseEligible: toStr(data.wageRaiseEligible),
      pastProduct: toStr(data.pastProduct),
      lostDate: toDateOrNull(data.lostDate),
      agentContractUrl: toStr(data.agentContractUrl),
      docCollectionStart: toDateOrNull(data.docCollectionStart),
      docSubmissionDate: toDateOrNull(data.docSubmissionDate),
      businessName: toStr(data.businessName),
      doc1: toStr(data.doc1),
      doc2: toStr(data.doc2),
      doc3: toStr(data.doc3),
      doc4: toStr(data.doc4),
      doc5: toStr(data.doc5),
      itStrategyNaviPdf: toStr(data.itStrategyNaviPdf),
      hasEmployees: toStr(data.hasEmployees),
      gbizidScreenshot: toStr(data.gbizidScreenshot),
      gbizidAddress: toStr(data.gbizidAddress),
      selfDeclarationId: toStr(data.selfDeclarationId),
      antiSocialCheck: toStr(data.antiSocialCheck),
      establishmentDate: toDateOrNull(data.establishmentDate),
      capital: toStr(data.capital),
      fiscalMonth: toStr(data.fiscalMonth),
      revenue: toDecimalOrNull(data.revenue),
      grossProfit: toDecimalOrNull(data.grossProfit),
      operatingProfit: toDecimalOrNull(data.operatingProfit),
      ordinaryProfit: toDecimalOrNull(data.ordinaryProfit),
      depreciation: toDecimalOrNull(data.depreciation),
      laborCost: toDecimalOrNull(data.laborCost),
      capitalOrReserve: toStr(data.capitalOrReserve),
      executiveCompensation: toDecimalOrNull(data.executiveCompensation),
      totalSalaryPrevYear: toDecimalOrNull(data.totalSalaryPrevYear),
      planYear1: toStr(data.planYear1),
      planYear2: toStr(data.planYear2),
      planYear3: toStr(data.planYear3),
      bonus1Target: toStr(data.bonus1Target),
      bonus1Doc: toStr(data.bonus1Doc),
      bonus2Target: toStr(data.bonus2Target),
      bonus2Doc: toStr(data.bonus2Doc),
      minWage: toStr(data.minWage),
      applicationSystem: toStr(data.applicationSystem),
      businessDescriptionDraft: toStr(data.businessDescriptionDraft),
      businessProcessNote: toStr(data.businessProcessNote),
      homepageUrl: toStr(data.homepageUrl),
      businessDescription: toStr(data.businessDescription),
      challengeTitle: toStr(data.challengeTitle),
      challengeGoal: toStr(data.challengeGoal),
      growthMatchingDescription: toStr(data.growthMatchingDescription),
      dataEntryStaff: toStr(data.dataEntryStaff),
      dataEntryConfirmed: toStr(data.dataEntryConfirmed),
      businessDescriptionFinal: toStr(data.businessDescriptionFinal),
      industryCode: toStr(data.industryCode),
      officeCount: data.officeCount ? Number(data.officeCount) : null,
      empRegular: data.empRegular ? Number(data.empRegular) : null,
      empContract: data.empContract ? Number(data.empContract) : null,
      empPartTime: data.empPartTime ? Number(data.empPartTime) : null,
      empDispatch: data.empDispatch ? Number(data.empDispatch) : null,
      empOther: data.empOther ? Number(data.empOther) : null,
      wageTable1: toStr(data.wageTable1),
      wageTable2: toStr(data.wageTable2),
      wageTable3: toStr(data.wageTable3),
      wageTable4: toStr(data.wageTable4),
      wageTable5: toStr(data.wageTable5),
      wageTable6: toStr(data.wageTable6),
      wageTable7: toStr(data.wageTable7),
      wageTable8: toStr(data.wageTable8),
      wageTable9: toStr(data.wageTable9),
      wageTable10: toStr(data.wageTable10),
    },
  });
  revalidatePath("/hojo/vendor");
}

export async function updatePreApplicationByVendor(id: number, vendorId: number, data: Record<string, unknown>) {
  const record = await prisma.hojoGrantCustomerPreApplication.findFirst({ where: { id, vendorId, deletedAt: null } });
  if (!record) throw new Error("レコードが見つかりません");

  const updateData: Record<string, unknown> = {};

  // String fields
  const strFields = [
    "applicantName", "referrer", "salesStaff", "category", "status", "prospectLevel",
    "detailMemo", "nextAction", "mtgRecordingUrl", "briefingStaff", "phone",
    "businessEntity", "industry", "systemType", "hasLoan", "revenueRange", "importantTags",
    "loanPattern", "agent1Number", "doubleChecker", "repeatJudgment", "wageRaiseEligible",
    "pastProduct", "agentContractUrl", "businessName", "doc1", "doc2", "doc3", "doc4", "doc5",
    "itStrategyNaviPdf", "hasEmployees", "gbizidScreenshot", "gbizidAddress", "selfDeclarationId",
    "antiSocialCheck", "capital", "fiscalMonth", "capitalOrReserve", "planYear1", "planYear2",
    "planYear3", "bonus1Target", "bonus1Doc", "bonus2Target", "bonus2Doc", "minWage",
    "applicationSystem", "businessDescriptionDraft", "businessProcessNote", "homepageUrl",
    "businessDescription", "challengeTitle", "challengeGoal", "growthMatchingDescription",
    "dataEntryStaff", "dataEntryConfirmed", "businessDescriptionFinal", "industryCode",
    "wageTable1", "wageTable2", "wageTable3", "wageTable4", "wageTable5",
    "wageTable6", "wageTable7", "wageTable8", "wageTable9", "wageTable10",
  ];
  for (const f of strFields) {
    if (f in data) updateData[f] = toStr(data[f]);
  }

  // Date fields
  const dateFields = ["nextContactDate", "overviewBriefingDate", "lostDate", "docCollectionStart", "docSubmissionDate", "establishmentDate"];
  for (const f of dateFields) {
    if (f in data) updateData[f] = toDateOrNull(data[f]);
  }

  // Decimal fields
  const decFields = ["referrerRewardPct", "agent1RewardPct", "totalReward", "revenue", "grossProfit", "operatingProfit", "ordinaryProfit", "depreciation", "laborCost", "executiveCompensation", "totalSalaryPrevYear"];
  for (const f of decFields) {
    if (f in data) updateData[f] = toDecimalOrNull(data[f]);
  }

  // Int fields
  const intFields = ["officeCount", "empRegular", "empContract", "empPartTime", "empDispatch", "empOther"];
  for (const f of intFields) {
    if (f in data) updateData[f] = data[f] ? Number(data[f]) : null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoGrantCustomerPreApplication.update({ where: { id }, data: updateData });
  }
  revalidatePath("/hojo/vendor");
}

export async function addPostApplicationByVendor(vendorId: number, data: Record<string, unknown>) {
  await prisma.hojoGrantCustomerPostApplication.create({
    data: {
      vendor: { connect: { id: vendorId } },
      isBpo: data.isBpo === true || data.isBpo === "true",
      applicantName: toStr(data.applicantName),
      memo: toStr(data.memo),
      referrer: toStr(data.referrer),
      salesStaff: toStr(data.salesStaff),
      applicationCompletedDate: toDateOrNull(data.applicationCompletedDate),
      applicationStaff: toStr(data.applicationStaff),
      grantApplicationNumber: toStr(data.grantApplicationNumber),
      nextAction: toStr(data.nextAction),
      nextContactDate: toDateOrNull(data.nextContactDate),
      documentStorageUrl: toStr(data.documentStorageUrl),
      existingDocuments: toStr(data.existingDocuments),
      staffEmail: toStr(data.staffEmail),
      growthMatchingUrl: toStr(data.growthMatchingUrl),
      growthMatchingStatus: toStr(data.growthMatchingStatus),
      wageRaise: toStr(data.wageRaise),
      laborSavingNavi: toStr(data.laborSavingNavi),
      invoiceRegistration: toStr(data.invoiceRegistration),
      repeatJudgment: toStr(data.repeatJudgment),
      subsidyApplicantName: toStr(data.subsidyApplicantName),
      prefecture: toStr(data.prefecture),
      recruitmentRound: toStr(data.recruitmentRound),
      applicationType: toStr(data.applicationType),
      subsidyStatus: toStr(data.subsidyStatus),
      subsidyStatusUpdated: toDateOrNull(data.subsidyStatusUpdated),
      subsidyVendorName: toStr(data.subsidyVendorName),
      itToolName: toStr(data.itToolName),
      subsidyTargetAmount: data.subsidyTargetAmount ? Number(data.subsidyTargetAmount) : null,
      subsidyAppliedAmount: data.subsidyAppliedAmount ? Number(data.subsidyAppliedAmount) : null,
      grantDecisionDate: toDateOrNull(data.grantDecisionDate),
      grantDecisionAmount: data.grantDecisionAmount ? Number(data.grantDecisionAmount) : null,
      confirmationApprovalDate: toDateOrNull(data.confirmationApprovalDate),
      subsidyConfirmedAmount: data.subsidyConfirmedAmount ? Number(data.subsidyConfirmedAmount) : null,
      hasLoan: data.hasLoan === true || data.hasLoan === "true",
      completedDate: toDateOrNull(data.completedDate),
      vendorPattern: toStr(data.vendorPattern),
      toolPattern: toStr(data.toolPattern),
    },
  });
  revalidatePath("/hojo/vendor");
}

export async function updatePostApplicationByVendor(id: number, vendorId: number, data: Record<string, unknown>) {
  const record = await prisma.hojoGrantCustomerPostApplication.findFirst({ where: { id, vendorId, deletedAt: null } });
  if (!record) throw new Error("レコードが見つかりません");

  const updateData: Record<string, unknown> = {};

  // Boolean
  if ("isBpo" in data) updateData.isBpo = data.isBpo === true || data.isBpo === "true";
  if ("hasLoan" in data) updateData.hasLoan = data.hasLoan === true || data.hasLoan === "true";

  // String fields
  const strFields = [
    "applicantName", "memo", "referrer", "salesStaff", "applicationStaff",
    "grantApplicationNumber", "nextAction", "documentStorageUrl", "existingDocuments",
    "staffEmail", "growthMatchingUrl", "growthMatchingStatus", "wageRaise",
    "laborSavingNavi", "invoiceRegistration", "repeatJudgment",
    "subsidyApplicantName", "prefecture", "recruitmentRound", "applicationType",
    "subsidyStatus", "subsidyVendorName", "itToolName",
    "vendorPattern", "toolPattern",
  ];
  for (const f of strFields) {
    if (f in data) updateData[f] = toStr(data[f]);
  }

  // Date fields
  const dateFields = ["applicationCompletedDate", "nextContactDate", "subsidyStatusUpdated", "grantDecisionDate", "confirmationApprovalDate", "completedDate"];
  for (const f of dateFields) {
    if (f in data) updateData[f] = toDateOrNull(data[f]);
  }

  // Int fields
  const intFields = ["subsidyTargetAmount", "subsidyAppliedAmount", "grantDecisionAmount", "subsidyConfirmedAmount"];
  for (const f of intFields) {
    if (f in data) updateData[f] = data[f] ? Number(data[f]) : null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoGrantCustomerPostApplication.update({ where: { id }, data: updateData });
  }
  revalidatePath("/hojo/vendor");
}

// ========== 借入申込フォーム回答の編集 ==========

type ChangeEntry = {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
};

type ChangeHistoryRecord = {
  changedAt: string;
  changedBy: string;
  changes: ChangeEntry[];
};

export async function updateLoanSubmissionAnswers(
  submissionId: number,
  vendorId: number,
  updatedFields: Record<string, { value: string; label: string }>
) {
  const session = await auth();
  const isStaff = await isStaffWithHojoEdit();
  const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

  if (!isStaff && !isVendor) {
    throw new Error("権限がありません");
  }

  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.deletedAt) {
    throw new Error("回答が見つかりません");
  }

  // ベンダー権限チェック: この回答がこのベンダーのものか
  const originalAnswers = submission.answers as Record<string, unknown>;
  if (originalAnswers._vendorId !== vendorId) {
    throw new Error("権限がありません");
  }

  // 現在の回答データ（変更済みがあればそちら、なければ元データ）
  const currentAnswers = (submission.modifiedAnswers ?? submission.answers) as Record<string, string>;

  // 変更差分を計算
  const changes: ChangeEntry[] = [];
  const newAnswers = { ...currentAnswers };

  for (const [key, { value, label }] of Object.entries(updatedFields)) {
    const oldVal = currentAnswers[key] || "";
    if (oldVal !== value) {
      changes.push({
        field: key,
        fieldLabel: label,
        oldValue: oldVal,
        newValue: value,
      });
      newAnswers[key] = value;
    }
  }

  if (changes.length === 0) {
    return; // 変更なし
  }

  // 変更履歴レコード
  const changedBy = session?.user?.name || (isStaff ? "スタッフ" : "ベンダー");
  const historyEntry: ChangeHistoryRecord = {
    changedAt: new Date().toISOString(),
    changedBy,
    changes,
  };

  const existingHistory = (submission.changeHistory as ChangeHistoryRecord[] | null) ?? [];

  await prisma.hojoFormSubmission.update({
    where: { id: submissionId },
    data: {
      modifiedAnswers: newAnswers,
      changeHistory: [...existingHistory, historyEntry],
    },
  });

  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/loan-submissions");
  revalidatePath("/hojo/lender");
}

// ========== 借入申込フォーム ベンダー備考更新 ==========

export async function updateLoanVendorMemo(
  submissionId: number,
  vendorId: number,
  memo: string
) {
  const session = await auth();
  const isStaff = await isStaffWithHojoEdit();
  const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

  if (!isStaff && !isVendor) {
    throw new Error("権限がありません");
  }

  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission || submission.deletedAt) {
    throw new Error("回答が見つかりません");
  }

  // ベンダー権限チェック: この回答がこのベンダーのものか
  if (!isStaff) {
    const answers = submission.answers as Record<string, unknown>;
    if (answers._vendorId !== vendorId) {
      throw new Error("権限がありません");
    }
  }

  await prisma.hojoFormSubmission.update({
    where: { id: submissionId },
    data: { vendorMemo: memo || null },
  });

  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/loan-submissions");
  revalidatePath("/hojo/lender");
}

// ========== 顧客進捗管理 除外/復活トグル ==========

export async function toggleProgressExclusion(
  submissionId: number,
  vendorId: number,
  exclude: boolean
) {
  const session = await auth();
  const isStaff = await isStaffWithHojoEdit();
  const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

  if (!isStaff && !isVendor) {
    throw new Error("権限がありません");
  }

  // formSubmissionIdでprogressレコードを検索
  const progress = await prisma.hojoLoanProgress.findUnique({
    where: { formSubmissionId: submissionId },
  });

  if (!progress) {
    throw new Error("進捗レコードが見つかりません");
  }

  if (!isStaff && progress.vendorId !== vendorId) {
    throw new Error("権限がありません");
  }

  await prisma.hojoLoanProgress.update({
    where: { id: progress.id },
    data: { deletedAt: exclude ? new Date() : null },
  });

  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/loan-progress");
  revalidatePath("/hojo/lender");
}

// ========== 顧客進捗管理 ==========

export async function updateVendorProgress(
  progressId: number,
  vendorId: number,
  field: string,
  value: string
) {
  const session = await auth();
  const isStaff = await isStaffWithHojoEdit();
  const isVendorUser = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;
  if (!isStaff && !isVendorUser) throw new Error("権限がありません");

  const progress = await prisma.hojoLoanProgress.findUnique({ where: { id: progressId } });
  if (!progress || progress.deletedAt || progress.vendorId !== vendorId) throw new Error("権限がありません");

  // ベンダーユーザーは限定フィールドのみ編集可
  const vendorFields = ["requestDate", "toolPurchasePrice", "fundTransferDate", "loanExecutionDate"];
  if (!isStaff && !vendorFields.includes(field)) throw new Error("権限がありません");

  // 依頼日はツール購入代金と貸付金額が一致している場合のみ入力可
  if (field === "requestDate" && value) {
    const toolNum = progress.toolPurchasePrice ? Number(progress.toolPurchasePrice) : null;
    const loanNum = progress.loanAmount ? Number(progress.loanAmount) : null;
    if (toolNum == null || loanNum == null || toolNum !== loanNum) {
      throw new Error("ツール購入代金を貸付金額と一致させてから入力してください");
    }
  }

  const updateData: Record<string, unknown> = {};
  if (field === "requestDate" || field === "fundTransferDate" || field === "redemptionDate") {
    updateData[field] = value ? new Date(value) : null;
  } else if (field === "loanExecutionDate") {
    updateData[field] = value ? new Date(value) : null;
  } else if (field === "toolPurchasePrice") {
    updateData[field] = value ? Number(value.replace(/,/g, "")) : null;
  } else {
    updateData[field] = value || null;
  }

  await prisma.hojoLoanProgress.update({ where: { id: progressId }, data: updateData });
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/loan-progress");
  revalidatePath("/hojo/lender");
}
