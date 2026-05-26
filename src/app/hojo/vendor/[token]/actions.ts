"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  FORM_UPDATE_STATUS,
  normalizeApplicantType,
  syncLoanProgressAfterWholesaleSave,
} from "@/lib/hojo/loan-progress-wholesale";
import { syncApplicationSupportAfterWholesaleSave } from "@/lib/hojo/application-support-wholesale";

async function isStaffWithHojoEdit(): Promise<boolean> {
  const session = await auth();
  const userType = session?.user?.userType;
  if (userType !== "staff") return false;
  return !!session?.user && canEditProjectMasterDataSync(session.user, "hojo");
}

async function loadLoanProgressRates() {
  try {
    if (!prisma.hojoLoanProgressRateConfig) {
      return { interestRate: 0.15, feeRate: 0.5 };
    }
    const config = await prisma.hojoLoanProgressRateConfig.findFirst({ orderBy: { id: "asc" } });
    return {
      interestRate: config ? Number(config.interestRate) : 0.15,
      feeRate: config ? Number(config.feeRate) : 0.5,
    };
  } catch (e) {
    console.warn("[loadLoanProgressRates] failed (migration not applied?):", e);
    return { interestRate: 0.15, feeRate: 0.5 };
  }
}

export async function registerVendorAccount(data: {
  name: string;
  email: string;
  password: string;
  vendorToken: string;
}): Promise<ActionResult> {
  try {
    const { name, email, password, vendorToken } = data;

    if (!name.trim() || !email.trim() || !password.trim()) {
      return err("すべての項目を入力してください");
    }
    if (password.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    // トークンからベンダーを特定
    const vendor = await prisma.hojoVendor.findUnique({
      where: { accessToken: vendorToken },
    });
    if (!vendor || !vendor.isActive) {
      return err("無効なURLです");
    }

    // メールアドレスの重複チェック
    const existingVendor = await prisma.hojoVendorAccount.findUnique({ where: { email: email.trim() } });
    if (existingVendor) return err("このメールアドレスは既に登録されています");
    const existingBbs = await prisma.hojoBbsAccount.findUnique({ where: { email: email.trim() } });
    if (existingBbs) return err("このメールアドレスは既に使用されています");
    const existingStaff = await prisma.masterStaff.findUnique({ where: { email: email.trim() } });
    if (existingStaff) return err("このメールアドレスは既に使用されています");

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.hojoVendorAccount.create({
      data: {
        vendorId: vendor.id,
        name: name.trim(),
        email: email.trim(),
        passwordHash,
      },
    });
    return ok();
  } catch (e) {
    console.error("[registerVendorAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
): Promise<ActionResult> {
  try {
    const staffEdit = await isStaffWithHojoEdit();
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
    });
    if (!record || record.deletedAt) {
      return err("レコードが見つかりません");
    }
    // スタッフはvendorId制約なし、ベンダーは自分のレコードのみ
    if (!staffEdit && record.vendorId !== vendorId) {
      return err("レコードが見つかりません");
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
    return ok();
  } catch (e) {
    console.error("[updateVendorFields] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function changeVendorPassword(accountId: number, newPassword: string): Promise<ActionResult> {
  // 認証: ベンダー本人の自己変更のみ許可。
  // 他人の accountId を指定された場合は拒否する。
  // スタッフによるリセットは hojo/settings/partner-accounts/actions.ts:resetVendorPassword を使う。
  const session = await auth();
  if (!session?.user) {
    return err("認証が必要です");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (session.user as any).userType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionVendorAccountId = (session.user as any).vendorAccountId as number | undefined;
  if (userType !== "vendor" || sessionVendorAccountId !== accountId) {
    return err("自分のアカウント以外のパスワードは変更できません");
  }

  try {
    if (newPassword.length < 8) return err("パスワードは8文字以上にしてください");
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.hojoVendorAccount.update({
      where: { id: accountId },
      data: { passwordHash, mustChangePassword: false },
    });
    return ok();
  } catch (e) {
    console.error("[changeVendorPassword] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 顧客情報管理 ==========

function parseUsageValue(value: unknown) {
  const text = value ? String(value).trim() : "";
  return text === "有" || text === "無" ? text : null;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function revalidateLoanPaths() {
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
  revalidatePath("/hojo/loan-progress");
  revalidatePath("/hojo/lender");
  revalidatePath("/hojo/loan-submissions");
  revalidatePath("/hojo/application-support");
  revalidatePath("/hojo/form-submissions");
  revalidatePath("/hojo/bbs");
  revalidatePath("/hojo/bbs/form-answers");
}

export async function addWholesaleAccount(vendorId: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const staffEdit = await isStaffWithHojoEdit();
    const session = await auth();
    const userType = session?.user?.userType;
    const sessionVendorId = session?.user?.vendorId;
    if (!staffEdit && (userType !== "vendor" || sessionVendorId !== vendorId)) {
      return err("権限がありません");
    }
    await prisma.$transaction(async (tx) => {
      const account = await tx.hojoWholesaleAccount.create({
        data: {
          vendorId,
          applicantType: normalizeApplicantType(data.applicantType),
          companyName: data.companyName ? String(data.companyName).trim() : null,
          email: data.email ? String(data.email).trim() : null,
          softwareSalesContractUrl: data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null,
          loanUsage: parseUsageValue(data.loanUsage),
          grantUsage: parseUsageValue(data.grantUsage),
          subsidyTargetAmountTaxIncluded: parseOptionalNumber(data.subsidyTargetAmountTaxIncluded),
          applicationAmount: parseOptionalNumber(data.applicationAmount),
          recruitmentRound: data.recruitmentRound ? Number(data.recruitmentRound) : null,
          adoptionDate: data.adoptionDate ? new Date(String(data.adoptionDate)) : null,
          issueRequestDate: data.issueRequestDate ? new Date(String(data.issueRequestDate)) : null,
          grantDate: data.grantDate ? new Date(String(data.grantDate)) : null,
        },
      });
      await syncLoanProgressAfterWholesaleSave(tx, account);
      await syncApplicationSupportAfterWholesaleSave(tx, account);
    });
    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[addWholesaleAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateWholesaleAccountByVendor(
  id: number,
  vendorId: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const staffEdit = await isStaffWithHojoEdit();
    const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
    if (!record || record.deletedAt) {
      return err("レコードが見つかりません");
    }
    if (!staffEdit && record.vendorId !== vendorId) {
      return err("レコードが見つかりません");
    }

    const updateData: Record<string, unknown> = {};
    if (data.applicantType !== undefined) updateData.applicantType = normalizeApplicantType(data.applicantType);
    if (data.companyName !== undefined) updateData.companyName = data.companyName ? String(data.companyName).trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
    if (data.softwareSalesContractUrl !== undefined) updateData.softwareSalesContractUrl = data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null;
    if (data.loanUsage !== undefined) updateData.loanUsage = parseUsageValue(data.loanUsage);
    if (data.grantUsage !== undefined) updateData.grantUsage = parseUsageValue(data.grantUsage);
    if (data.subsidyTargetAmountTaxIncluded !== undefined) updateData.subsidyTargetAmountTaxIncluded = parseOptionalNumber(data.subsidyTargetAmountTaxIncluded);
    if (data.applicationAmount !== undefined) updateData.applicationAmount = parseOptionalNumber(data.applicationAmount);
    if (data.recruitmentRound !== undefined) updateData.recruitmentRound = data.recruitmentRound ? Number(data.recruitmentRound) : null;
    const dateFields = ["adoptionDate", "issueRequestDate", "grantDate"];
    for (const field of dateFields) {
      if (data[field] !== undefined) updateData[field] = data[field] ? new Date(String(data[field])) : null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.hojoWholesaleAccount.update({ where: { id }, data: updateData });
        await syncLoanProgressAfterWholesaleSave(tx, updated, record.loanUsage);
        await syncApplicationSupportAfterWholesaleSave(tx, updated, record.grantUsage);
      });
    }
    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[updateWholesaleAccountByVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteWholesaleAccountByVendor(id: number, vendorId: number): Promise<ActionResult> {
  try {
    const staffEdit = await isStaffWithHojoEdit();
    const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
    if (!record) return err("レコードが見つかりません");
    if (!staffEdit && record.vendorId !== vendorId) return err("レコードが見つかりません");
    await prisma.hojoWholesaleAccount.update({
      where: { id },
      data: { deletedByVendor: true },
    });
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/security-cloud/accounts");
    return ok();
  } catch (e) {
    console.error("[deleteWholesaleAccountByVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
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
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isStaff = await isStaffWithHojoEdit();
    const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

    if (!isStaff && !isVendor) {
      return err("権限がありません");
    }

    const submission = await prisma.hojoFormSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.deletedAt) {
      return err("回答が見つかりません");
    }

    // ベンダー権限チェック: この回答がこのベンダーのものか
    const originalAnswers = submission.answers as Record<string, unknown>;
    if (originalAnswers._vendorId !== vendorId) {
      return err("権限がありません");
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
      return ok(); // 変更なし
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
    return ok();
  } catch (e) {
    console.error("[updateLoanSubmissionAnswers] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

function getAnswerValue(answers: Record<string, unknown>, key: string) {
  const value = answers[key];
  return value == null ? "" : String(value);
}

function getLoanAnswerLabel(key: string) {
  const labels: Record<string, string> = {
    corp_company_name: "法人名称(正式名称)",
    corp_loan_amount: "借入希望金額",
    corp_rep_name: "代表者氏名(正式名称)",
    corp_email: "メールアドレス",
    corp_phone: "法人電話番号",
    ind_business_name: "屋号(正式名称)",
    ind_loan_amount: "借入希望金額",
    ind_name: "氏名(正式名称)",
    ind_email: "メールアドレス",
    ind_phone: "電話番号",
  };
  return labels[key] ?? key;
}

export async function applyPendingLoanFormSubmission(
  progressId: number,
  vendorId: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;
    if (!isVendor) return err("修正申請の反映はベンダーアカウントのみ実行できます");

    const progress = await prisma.hojoLoanProgress.findUnique({
      where: { id: progressId },
      include: { formSubmission: true },
    });
    if (!progress || progress.vendorId !== vendorId || !progress.pendingAnswers || !progress.formSubmission) {
      return err("反映できる修正申請がありません");
    }

    const pendingAnswers = progress.pendingAnswers as Record<string, unknown>;
    const currentAnswers = (progress.formSubmission.modifiedAnswers ?? progress.formSubmission.answers) as Record<string, unknown>;
    const changes: ChangeEntry[] = [];
    const newAnswers = { ...currentAnswers };

    for (const [key, value] of Object.entries(pendingAnswers)) {
      const oldValue = getAnswerValue(currentAnswers, key);
      const newValue = value == null ? "" : String(value);
      if (oldValue !== newValue) {
        changes.push({
          field: key,
          fieldLabel: getLoanAnswerLabel(key),
          oldValue,
          newValue,
        });
        newAnswers[key] = value;
      }
    }

    const existingHistory = (progress.formSubmission.changeHistory as ChangeHistoryRecord[] | null) ?? [];
    const historyEntry: ChangeHistoryRecord = {
      changedAt: new Date().toISOString(),
      changedBy: session?.user?.name || "ベンダー",
      changes,
    };

    await prisma.$transaction(async (tx) => {
      await tx.hojoFormSubmission.update({
        where: { id: progress.formSubmissionId! },
        data: {
          modifiedAnswers: newAnswers as Prisma.InputJsonValue,
          changeHistory: (changes.length > 0 ? [...existingHistory, historyEntry] : existingHistory) as Prisma.InputJsonValue,
        },
      });
      await tx.hojoLoanProgress.update({
        where: { id: progress.id },
        data: {
          pendingAnswers: Prisma.DbNull,
          pendingFormType: null,
          formUpdateStatus: FORM_UPDATE_STATUS.APPLIED,
          representName: progress.pendingFormType === "loan-corporate"
            ? getAnswerValue(pendingAnswers, "corp_rep_name") || progress.representName
            : getAnswerValue(pendingAnswers, "ind_name") || progress.representName,
        },
      });
    });

    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[applyPendingLoanFormSubmission] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function rejectPendingLoanFormSubmission(
  progressId: number,
  vendorId: number
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;
    if (!isVendor) return err("修正申請の却下はベンダーアカウントのみ実行できます");

    const progress = await prisma.hojoLoanProgress.findUnique({ where: { id: progressId } });
    if (!progress || progress.vendorId !== vendorId || !progress.pendingAnswers) {
      return err("却下できる修正申請がありません");
    }

    await prisma.hojoLoanProgress.update({
      where: { id: progress.id },
      data: {
        pendingAnswers: Prisma.DbNull,
        pendingFormType: null,
        formUpdateStatus: FORM_UPDATE_STATUS.REJECTED,
      },
    });

    revalidateLoanPaths();
    return ok();
  } catch (e) {
    console.error("[rejectPendingLoanFormSubmission] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 借入申込フォーム ベンダー備考更新 ==========

export async function updateLoanVendorMemo(
  submissionId: number,
  vendorId: number,
  memo: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isStaff = await isStaffWithHojoEdit();
    const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

    if (!isStaff && !isVendor) {
      return err("権限がありません");
    }

    const submission = await prisma.hojoFormSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.deletedAt) {
      return err("回答が見つかりません");
    }

    // ベンダー権限チェック: この回答がこのベンダーのものか
    if (!isStaff) {
      const answers = submission.answers as Record<string, unknown>;
      if (answers._vendorId !== vendorId) {
        return err("権限がありません");
      }
    }

    await prisma.hojoFormSubmission.update({
      where: { id: submissionId },
      data: { vendorMemo: memo || null },
    });

    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/loan-submissions");
    revalidatePath("/hojo/lender");
    return ok();
  } catch (e) {
    console.error("[updateLoanVendorMemo] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 顧客進捗管理 除外/復活トグル ==========

export async function toggleProgressExclusion(
  submissionId: number,
  vendorId: number,
  exclude: boolean
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isStaff = await isStaffWithHojoEdit();
    const isVendor = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;

    if (!isStaff && !isVendor) {
      return err("権限がありません");
    }

    // formSubmissionIdでprogressレコードを検索
    const progress = await prisma.hojoLoanProgress.findUnique({
      where: { formSubmissionId: submissionId },
    });

    if (!progress) {
      return err("進捗レコードが見つかりません");
    }

    if (!isStaff && progress.vendorId !== vendorId) {
      return err("権限がありません");
    }

    await prisma.hojoLoanProgress.update({
      where: { id: progress.id },
      data: { deletedAt: exclude ? new Date() : null },
    });

    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/loan-progress");
    revalidatePath("/hojo/lender");
    return ok();
  } catch (e) {
    console.error("[toggleProgressExclusion] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ========== 顧客進捗管理 ==========

export async function updateVendorProgress(
  progressId: number,
  vendorId: number,
  field: string,
  value: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    const isStaff = await isStaffWithHojoEdit();
    const isVendorUser = session?.user?.userType === "vendor" && session?.user?.vendorId === vendorId;
    if (!isStaff && !isVendorUser) return err("権限がありません");

    const progress = await prisma.hojoLoanProgress.findUnique({ where: { id: progressId } });
    if (!progress || progress.deletedAt || progress.vendorId !== vendorId) return err("権限がありません");

    // ベンダーユーザーは限定フィールドのみ編集可
    const vendorFields = ["requestDate", "toolPurchasePrice", "fundTransferDate", "loanExecutionDate"];
    if (!isStaff && !vendorFields.includes(field)) return err("権限がありません");

    // 依頼日はツール購入代金と貸付金額が一致している場合のみ入力可
    if (field === "requestDate" && value) {
      const toolNum = progress.toolPurchasePrice ? Number(progress.toolPurchasePrice) : null;
      const loanNum = progress.loanAmount ? Number(progress.loanAmount) : null;
      if (toolNum == null || loanNum == null || toolNum !== loanNum) {
        return err("ツール購入代金を貸付金額と一致させてから入力してください");
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

    if (field === "loanExecutionDate") {
      const { computeDerivedFields } = await import("@/lib/hojo/loan-progress-calc");
      const rates = await loadLoanProgressRates();
      const loanExecutionDate = updateData.loanExecutionDate as Date | null;
      const derived = computeDerivedFields(
        {
          loanAmount: progress.loanAmount === null ? null : Number(progress.loanAmount),
          loanExecutionDate,
          repaymentDate: progress.repaymentDate,
          repaymentAmount: progress.repaymentAmount === null ? null : Number(progress.repaymentAmount),
          secondaryRepaymentDate: progress.secondaryRepaymentDate,
        },
        rates,
      );
      updateData.interestAmount = derived.interestAmount;
      updateData.operationFee = derived.operationFee;
      updateData.redemptionAmount = derived.redemptionAmount;
      updateData.secondaryRepaymentAmount = derived.secondaryRepaymentAmount;
      updateData.secondaryPrincipalAmount = derived.secondaryPrincipalAmount;
      updateData.secondaryInterestAmount = derived.secondaryInterestAmount;
      updateData.secondaryRedemptionAmount = derived.secondaryRedemptionAmount;
    }

    await prisma.hojoLoanProgress.update({ where: { id: progressId }, data: updateData });
    revalidatePath("/hojo/vendor");
    revalidatePath("/hojo/loan-progress");
    revalidatePath("/hojo/lender");
    return ok();
  } catch (e) {
    console.error("[updateVendorProgress] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
