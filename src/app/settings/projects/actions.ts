"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { getSession } from "@/lib/auth";
import { toBoolean } from "@/lib/utils";

export async function updateProject(id: number, data: Record<string, unknown>) {
  await requireProjectMasterDataEditPermission();
  // code は変更不可（コード側でロジック分岐に使用するため）
  const updateData: Record<string, unknown> = {};
  if ("name" in data) updateData.name = data.name as string;
  if ("description" in data) updateData.description = (data.description as string) || null;
  if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);
  if ("operatingCompanyId" in data) updateData.operatingCompanyId = data.operatingCompanyId ? Number(data.operatingCompanyId) : null;

  if (Object.keys(updateData).length > 0) {
    await prisma.masterProject.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/settings/projects");
}

export async function reorderProjects(orderedIds: number[]) {
  await requireProjectMasterDataEditPermission();
  // トランザクションで一括更新
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.masterProject.update({
        where: { id },
        data: { displayOrder: index + 1 },
      })
    )
  );
  revalidatePath("/settings/projects");
}

// ============================================
// プロジェクトメール: 一覧取得
// ============================================

export async function getProjectEmails(projectId: number) {
  const records = await prisma.projectEmail.findMany({
    where: { projectId },
    include: {
      email: {
        select: {
          id: true,
          email: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          imapHost: true,
          imapPort: true,
          imapUser: true,
          imapPass: true,
          enableInbound: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    emailId: r.emailId,
    email: r.email.email,
    memo: r.memo,
    isDefault: r.isDefault,
    smtpHost: r.email.smtpHost,
    smtpPort: r.email.smtpPort,
    hasSmtpPass: !!r.email.smtpPass,
    hasSmtpConfig: !!(r.email.smtpHost && r.email.smtpUser && r.email.smtpPass),
    imapHost: r.email.imapHost,
    imapPort: r.email.imapPort,
    enableInbound: r.email.enableInbound,
  }));
}

// ============================================
// プロジェクトメール: 運営法人の未追加メール一覧取得
// ============================================

export async function getAvailableEmails(projectId: number) {
  const project = await prisma.masterProject.findUnique({
    where: { id: projectId },
    select: { operatingCompanyId: true },
  });
  if (!project?.operatingCompanyId) return [];

  const existing = await prisma.projectEmail.findMany({
    where: { projectId },
    select: { emailId: true },
  });
  const existingIds = existing.map((e) => e.emailId);

  const emails = await prisma.operatingCompanyEmail.findMany({
    where: {
      operatingCompanyId: project.operatingCompanyId,
      deletedAt: null,
      ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      label: true,
      smtpHost: true,
      smtpUser: true,
      smtpPass: true,
      enableInbound: true,
    },
  });

  return emails.map((e) => ({
    id: e.id,
    email: e.email,
    label: e.label,
    hasSmtpConfig: !!(e.smtpHost && e.smtpUser && e.smtpPass),
    enableInbound: e.enableInbound,
  }));
}

// ============================================
// プロジェクトメール: 既存メールをリンク
// ============================================

export async function linkExistingEmail(data: {
  projectId: number;
  emailId: number;
  memo?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  // 重複チェック
  const existing = await prisma.projectEmail.findUnique({
    where: { projectId_emailId: { projectId: data.projectId, emailId: data.emailId } },
  });
  if (existing) {
    return { success: false, error: "このメールアドレスは既に登録されています" };
  }

  // メールが存在するか確認
  const opEmail = await prisma.operatingCompanyEmail.findFirst({
    where: { id: data.emailId, deletedAt: null },
  });
  if (!opEmail) {
    return { success: false, error: "メールアドレスが見つかりません" };
  }

  await prisma.projectEmail.create({
    data: {
      projectId: data.projectId,
      emailId: data.emailId,
      isDefault: false,
      memo: data.memo ?? null,
    },
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクトメール: 新規追加
// ============================================

export async function addProjectEmail(data: {
  projectId: number;
  email: string;
  memo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpPass?: string | null;
  imapHost?: string | null;
  imapPort?: number | null;
  enableInbound?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  // プロジェクトの運営法人ID（あれば使う、なくてもOK）
  const project = await prisma.masterProject.findUnique({
    where: { id: data.projectId },
    select: { operatingCompanyId: true },
  });

  const emailAddr = data.email.trim();

  // 同じメールアドレスが既に OperatingCompanyEmail に存在するか確認
  const existingOpEmail = await prisma.operatingCompanyEmail.findFirst({
    where: {
      email: emailAddr,
      deletedAt: null,
    },
  });

  if (existingOpEmail) {
    // 既に存在する場合はリンクのみ作成（重複登録防止）
    const existingLink = await prisma.projectEmail.findUnique({
      where: { projectId_emailId: { projectId: data.projectId, emailId: existingOpEmail.id } },
    });
    if (existingLink) {
      return { success: false, error: "このメールアドレスは既に登録されています" };
    }

    await prisma.projectEmail.create({
      data: {
        projectId: data.projectId,
        emailId: existingOpEmail.id,
        isDefault: false,
        memo: data.memo ?? null,
      },
    });

    revalidatePath("/settings/projects");
    return { success: true };
  }

  // 新規作成
  const user = await getSession();

  await prisma.$transaction(async (tx) => {
    const opEmail = await tx.operatingCompanyEmail.create({
      data: {
        operatingCompanyId: project?.operatingCompanyId ?? null,
        email: emailAddr,
        label: data.memo ?? null,
        smtpHost: data.smtpHost ?? "smtp.gmail.com",
        smtpPort: data.smtpPort ?? 587,
        smtpUser: emailAddr,
        smtpPass: data.smtpPass ?? null,
        imapHost: data.imapHost ?? "imap.gmail.com",
        imapPort: data.imapPort ?? 993,
        imapUser: emailAddr,
        imapPass: data.smtpPass ?? null,
        enableInbound: data.enableInbound ?? false,
        isDefault: false,
        createdBy: user.id,
      },
    });

    await tx.projectEmail.create({
      data: {
        projectId: data.projectId,
        emailId: opEmail.id,
        isDefault: false,
        memo: data.memo ?? null,
      },
    });
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクトメール: メモ更新
// ============================================

export async function updateProjectEmailMemo(
  projectEmailId: number,
  memo: string | null
): Promise<void> {
  await requireProjectMasterDataEditPermission();
  await prisma.projectEmail.update({
    where: { id: projectEmailId },
    data: { memo },
  });
  revalidatePath("/settings/projects");
}

// ============================================
// プロジェクトメール: メール設定更新（admin専用）
// ============================================

async function requireSystemAdmin() {
  const user = await getSession();
  if (user.loginId !== "admin") {
    throw new Error("メール設定の変更にはシステム管理者権限が必要です");
  }
  return user;
}

export async function updateEmailSettings(
  emailId: number,
  data: {
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpPass?: string | null;
    imapHost?: string | null;
    imapPort?: number | null;
    enableInbound?: boolean;
  }
): Promise<void> {
  const user = await requireSystemAdmin();

  const updateData: Record<string, unknown> = { updatedBy: user.id };
  if ("smtpHost" in data) updateData.smtpHost = data.smtpHost ?? null;
  if ("smtpPort" in data) updateData.smtpPort = data.smtpPort ?? null;
  if ("smtpPass" in data && data.smtpPass) {
    updateData.smtpPass = data.smtpPass;
    updateData.imapPass = data.smtpPass;
  }
  if ("imapHost" in data) updateData.imapHost = data.imapHost ?? null;
  if ("imapPort" in data) updateData.imapPort = data.imapPort ?? null;
  if ("enableInbound" in data) updateData.enableInbound = data.enableInbound;

  // smtpUser/imapUser はメールアドレスと同じ値を自動設定
  // enableInbound有効化時にimapPassが未設定ならsmtpPassをコピー
  const email = await prisma.operatingCompanyEmail.findUnique({
    where: { id: emailId },
    select: { email: true, smtpPass: true, imapPass: true },
  });
  if (email) {
    updateData.smtpUser = email.email;
    updateData.imapUser = email.email;
    if (data.enableInbound && !updateData.imapPass && !email.imapPass && email.smtpPass) {
      updateData.imapPass = email.smtpPass;
    }
  }

  await prisma.operatingCompanyEmail.update({
    where: { id: emailId },
    data: updateData,
  });

  revalidatePath("/settings/projects");
}

/** @deprecated updateEmailSettings を使用してください */
export const updateEmailSmtp = updateEmailSettings;

// ============================================
// プロジェクトメール: デフォルト送信元の設定
// ============================================

export async function setProjectDefaultEmail(
  projectId: number,
  projectEmailId: number | null
): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  if (projectEmailId === null) {
    await prisma.projectEmail.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    });
    revalidatePath("/settings/projects");
    return { success: true };
  }

  const pe = await prisma.projectEmail.findUnique({
    where: { id: projectEmailId },
    include: { email: true },
  });
  if (!pe) return { success: false, error: "メールアドレスが見つかりません" };
  if (pe.projectId !== projectId) return { success: false, error: "プロジェクトが一致しません" };

  if (!pe.email.smtpHost || !pe.email.smtpUser || !pe.email.smtpPass) {
    return { success: false, error: "SMTP設定が未完了のため、デフォルト送信元に設定できません。管理者にSMTP設定を依頼してください。" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectEmail.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.projectEmail.update({
      where: { id: projectEmailId },
      data: { isDefault: true },
    });
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクトメール: 削除
// ============================================

export async function deleteProjectEmail(id: number): Promise<void> {
  await requireProjectMasterDataEditPermission();
  await prisma.projectEmail.delete({ where: { id } });
  revalidatePath("/settings/projects");
}

// ============================================
// プロジェクト銀行口座: 一覧取得
// ============================================

export async function getProjectBankAccounts(projectId: number) {
  const records = await prisma.projectBankAccount.findMany({
    where: { projectId },
    include: {
      bankAccount: {
        select: {
          id: true,
          operatingCompanyId: true,
          bankName: true,
          branchName: true,
          accountType: true,
          accountNumber: true,
          accountHolderName: true,
          note: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    bankAccountId: r.bankAccountId,
    bankName: r.bankAccount.bankName,
    branchName: r.bankAccount.branchName,
    accountType: r.bankAccount.accountType,
    accountNumber: r.bankAccount.accountNumber,
    accountHolderName: r.bankAccount.accountHolderName,
    memo: r.memo,
    isDefault: r.isDefault,
  }));
}

// ============================================
// プロジェクト銀行口座: 追加
// ============================================

export async function addProjectBankAccount(data: {
  projectId: number;
  bankAccountId: number;
  memo?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  // プロジェクトの運営法人を確認
  const project = await prisma.masterProject.findUnique({
    where: { id: data.projectId },
    select: { operatingCompanyId: true },
  });
  if (!project?.operatingCompanyId) {
    return { success: false, error: "プロジェクトに運営法人が設定されていません" };
  }

  // 口座が同じ運営法人に属するか確認
  const ba = await prisma.operatingCompanyBankAccount.findUnique({
    where: { id: data.bankAccountId },
    select: { operatingCompanyId: true, deletedAt: true },
  });
  if (!ba || ba.deletedAt) {
    return { success: false, error: "銀行口座が見つかりません" };
  }
  if (ba.operatingCompanyId !== project.operatingCompanyId) {
    return { success: false, error: "この口座はプロジェクトの運営法人に属していません" };
  }

  // 重複チェック
  const existing = await prisma.projectBankAccount.findUnique({
    where: { projectId_bankAccountId: { projectId: data.projectId, bankAccountId: data.bankAccountId } },
  });
  if (existing) {
    return { success: false, error: "この口座は既に登録されています" };
  }

  await prisma.projectBankAccount.create({
    data: {
      projectId: data.projectId,
      bankAccountId: data.bankAccountId,
      isDefault: false,
      memo: data.memo ?? null,
    },
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクト銀行口座: デフォルト切り替え
// ============================================

export async function setProjectDefaultBankAccount(
  projectId: number,
  projectBankAccountId: number | null
): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  if (projectBankAccountId === null) {
    await prisma.projectBankAccount.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    });
    revalidatePath("/settings/projects");
    return { success: true };
  }

  const pba = await prisma.projectBankAccount.findUnique({
    where: { id: projectBankAccountId },
  });
  if (!pba) return { success: false, error: "銀行口座が見つかりません" };
  if (pba.projectId !== projectId) return { success: false, error: "プロジェクトが一致しません" };

  await prisma.$transaction(async (tx) => {
    await tx.projectBankAccount.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.projectBankAccount.update({
      where: { id: projectBankAccountId },
      data: { isDefault: true },
    });
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクト銀行口座: メモ更新
// ============================================

export async function updateProjectBankAccountMemo(
  projectBankAccountId: number,
  memo: string | null
): Promise<void> {
  await requireProjectMasterDataEditPermission();
  await prisma.projectBankAccount.update({
    where: { id: projectBankAccountId },
    data: { memo },
  });
  revalidatePath("/settings/projects");
}

// ============================================
// プロジェクト銀行口座: 削除
// ============================================

export async function deleteProjectBankAccount(id: number): Promise<void> {
  await requireProjectMasterDataEditPermission();
  await prisma.projectBankAccount.delete({ where: { id } });
  revalidatePath("/settings/projects");
}

// ============================================
// プロジェクト銀行口座: 新規追加（運営法人にも自動作成）
// ============================================

export async function createAndAddProjectBankAccount(data: {
  projectId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountType?: string;
  accountNumber: string;
  accountHolderName: string;
  memo?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireProjectMasterDataEditPermission();

  // プロジェクトの運営法人を確認
  const project = await prisma.masterProject.findUnique({
    where: { id: data.projectId },
    select: { operatingCompanyId: true },
  });
  if (!project?.operatingCompanyId) {
    return { success: false, error: "プロジェクトに運営法人が設定されていません" };
  }

  // トランザクションで運営法人口座作成 + プロジェクトリンク
  await prisma.$transaction(async (tx) => {
    const bankAccount = await tx.operatingCompanyBankAccount.create({
      data: {
        operatingCompanyId: project.operatingCompanyId!,
        bankName: data.bankName.trim(),
        bankCode: data.bankCode.trim(),
        branchName: data.branchName.trim(),
        branchCode: data.branchCode.trim(),
        accountType: data.accountType || "普通",
        accountNumber: data.accountNumber.trim(),
        accountHolderName: data.accountHolderName.trim(),
        note: data.memo?.trim() || null,
      },
    });

    await tx.projectBankAccount.create({
      data: {
        projectId: data.projectId,
        bankAccountId: bankAccount.id,
        isDefault: false,
        memo: data.memo?.trim() || null,
      },
    });
  });

  revalidatePath("/settings/projects");
  return { success: true };
}

// ============================================
// プロジェクト銀行口座: 未追加口座一覧取得
// ============================================

export async function getAvailableBankAccounts(projectId: number) {
  const project = await prisma.masterProject.findUnique({
    where: { id: projectId },
    select: { operatingCompanyId: true },
  });
  if (!project?.operatingCompanyId) return [];

  const existing = await prisma.projectBankAccount.findMany({
    where: { projectId },
    select: { bankAccountId: true },
  });
  const existingIds = existing.map((e) => e.bankAccountId);

  const accounts = await prisma.operatingCompanyBankAccount.findMany({
    where: {
      operatingCompanyId: project.operatingCompanyId,
      deletedAt: null,
      id: { notIn: existingIds.length > 0 ? existingIds : undefined },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      bankName: true,
      branchName: true,
      accountType: true,
      accountNumber: true,
      accountHolderName: true,
    },
  });

  return accounts;
}
