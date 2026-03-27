"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin, isFounder, isSystemAdmin } from "@/lib/auth";

// ============================================
// 管理者権限チェック
// ============================================

async function requireAdminUser() {
  const user = await getSession();
  if (isSystemAdmin(user) || isFounder(user)) return user;
  const hasAdmin = isAdmin(user.permissions, "stella") ||
    isAdmin(user.permissions, "stp");
  if (!hasAdmin) {
    throw new Error("管理者権限が必要です");
  }
  return user;
}

// ============================================
// プロジェクト一覧取得
// ============================================

export async function getProjects() {
  const projects = await prisma.masterProject.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      operatingCompanyId: true,
    },
    orderBy: { displayOrder: "asc" },
  });
  return projects;
}

// ============================================
// プロジェクト別メールアドレス一覧取得
// ============================================

export async function getProjectEmails() {
  const records = await prisma.projectEmail.findMany({
    include: {
      project: { select: { id: true, name: true, code: true } },
      email: {
        select: {
          id: true,
          email: true,
          label: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          isDefault: true,
          operatingCompany: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: [{ projectId: "asc" }, { isDefault: "desc" }, { id: "asc" }],
  });

  return records.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project.name,
    projectCode: r.project.code,
    emailId: r.emailId,
    email: r.email.email,
    emailLabel: r.email.label,
    memo: r.memo,
    isDefault: r.isDefault,
    operatingCompanyId: r.email.operatingCompany?.id ?? null,
    operatingCompanyName: r.email.operatingCompany?.companyName ?? "",
    smtpHost: r.email.smtpHost,
    smtpPort: r.email.smtpPort,
    smtpUser: r.email.smtpUser,
    hasSmtpPass: !!r.email.smtpPass,
    hasSmtpConfig: !!(r.email.smtpHost && r.email.smtpUser && r.email.smtpPass),
  }));
}

// ============================================
// メールアドレス追加（OperatingCompanyEmail + ProjectEmail を同時作成）
// ============================================

export async function addProjectEmail(data: {
  projectId: number;
  email: string;
  memo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
  isDefault: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdminUser();

  // プロジェクトの運営法人ID（あれば使う）
  const project = await prisma.masterProject.findUnique({
    where: { id: data.projectId },
    select: { operatingCompanyId: true },
  });

  // デフォルト設定時はSMTP必須
  if (data.isDefault) {
    if (!data.smtpHost || !data.smtpUser || !data.smtpPass) {
      return { success: false, error: "デフォルト送信元にするにはSMTP設定（ホスト・ユーザー・パスワード）が必要です" };
    }
  }

  // 同じメールアドレスが既に OperatingCompanyEmail に存在するか確認
  let opEmail = await prisma.operatingCompanyEmail.findFirst({
    where: {
      email: data.email,
      deletedAt: null,
    },
  });

  await prisma.$transaction(async (tx) => {
    // OperatingCompanyEmail がなければ作成、あればSMTP更新
    if (!opEmail) {
      opEmail = await tx.operatingCompanyEmail.create({
        data: {
          operatingCompanyId: project?.operatingCompanyId ?? null,
          email: data.email,
          label: data.memo ?? null,
          smtpHost: data.smtpHost ?? null,
          smtpPort: data.smtpPort ?? null,
          smtpUser: data.smtpUser ?? null,
          smtpPass: data.smtpPass ?? null,
          isDefault: false,
          createdBy: user.id,
        },
      });
    } else {
      // SMTP情報を更新（入力がある場合のみ）
      const updateData: Record<string, unknown> = { updatedBy: user.id };
      if (data.smtpHost !== undefined) updateData.smtpHost = data.smtpHost ?? null;
      if (data.smtpPort !== undefined) updateData.smtpPort = data.smtpPort ?? null;
      if (data.smtpUser !== undefined) updateData.smtpUser = data.smtpUser ?? null;
      if (data.smtpPass) updateData.smtpPass = data.smtpPass;
      if (data.memo !== undefined) updateData.label = data.memo ?? null;

      await tx.operatingCompanyEmail.update({
        where: { id: opEmail.id },
        data: updateData,
      });
    }

    // isDefault なら同プロジェクトの既存デフォルトを解除
    if (data.isDefault) {
      await tx.projectEmail.updateMany({
        where: { projectId: data.projectId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // ProjectEmail upsert
    await tx.projectEmail.upsert({
      where: {
        projectId_emailId: {
          projectId: data.projectId,
          emailId: opEmail!.id,
        },
      },
      create: {
        projectId: data.projectId,
        emailId: opEmail!.id,
        isDefault: data.isDefault,
        memo: data.memo ?? null,
      },
      update: {
        isDefault: data.isDefault,
        memo: data.memo ?? null,
      },
    });
  });

  revalidatePath("/admin/email-settings");
  return { success: true };
}

// ============================================
// SMTP設定更新（既存メールアドレスのSMTP情報を編集）
// ============================================

export async function updateEmailSmtp(
  emailId: number,
  data: {
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpUser?: string | null;
    smtpPass?: string | null;
  }
): Promise<void> {
  const user = await requireAdminUser();

  const updateData: Record<string, unknown> = { updatedBy: user.id };
  if ("smtpHost" in data) updateData.smtpHost = data.smtpHost ?? null;
  if ("smtpPort" in data) updateData.smtpPort = data.smtpPort ?? null;
  if ("smtpUser" in data) updateData.smtpUser = data.smtpUser ?? null;
  if ("smtpPass" in data && data.smtpPass) updateData.smtpPass = data.smtpPass;

  await prisma.operatingCompanyEmail.update({
    where: { id: emailId },
    data: updateData,
  });

  revalidatePath("/admin/email-settings");
}

// ============================================
// ProjectEmail メモ更新
// ============================================

export async function updateProjectEmailMemo(
  projectEmailId: number,
  memo: string | null
): Promise<void> {
  await requireAdminUser();

  await prisma.projectEmail.update({
    where: { id: projectEmailId },
    data: { memo },
  });

  revalidatePath("/admin/email-settings");
}

// ============================================
// デフォルト送信元の切り替え
// ============================================

export async function setProjectEmailDefault(
  projectEmailId: number
): Promise<{ success: boolean; error?: string }> {
  await requireAdminUser();

  const pe = await prisma.projectEmail.findUnique({
    where: { id: projectEmailId },
    include: { email: true },
  });
  if (!pe) return { success: false, error: "設定が見つかりません" };

  // SMTP設定チェック
  if (!pe.email.smtpHost || !pe.email.smtpUser || !pe.email.smtpPass) {
    return { success: false, error: "SMTP設定（ホスト・ユーザー・アプリパスワード）が未設定のため、デフォルト送信元に設定できません" };
  }

  await prisma.$transaction(async (tx) => {
    // 同プロジェクトの既存デフォルトを解除
    await tx.projectEmail.updateMany({
      where: { projectId: pe.projectId, isDefault: true },
      data: { isDefault: false },
    });
    // 対象をデフォルトに
    await tx.projectEmail.update({
      where: { id: projectEmailId },
      data: { isDefault: true },
    });
  });

  revalidatePath("/admin/email-settings");
  return { success: true };
}

// ============================================
// デフォルト解除
// ============================================

export async function unsetProjectEmailDefault(
  projectEmailId: number
): Promise<void> {
  await requireAdminUser();

  await prisma.projectEmail.update({
    where: { id: projectEmailId },
    data: { isDefault: false },
  });

  revalidatePath("/admin/email-settings");
}

// ============================================
// ProjectEmail 削除
// ============================================

export async function deleteProjectEmail(id: number): Promise<void> {
  await requireAdminUser();
  await prisma.projectEmail.delete({ where: { id } });
  revalidatePath("/admin/email-settings");
}
