"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { getSession } from "@/lib/auth/session";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

type OperatingCompanyEmailDto = {
  id: number;
  operatingCompanyId: number | null;
  email: string;
  label: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPass: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  hasImapPass: boolean;
  enableInbound: boolean;
  isDefault: boolean;
};

export async function addOperatingCompanyEmail(
  operatingCompanyId: number,
  data: Record<string, unknown>
): Promise<ActionResult<OperatingCompanyEmailDto>> {
  try {
    await requireMasterDataEditPermission();
    const session = await getSession();
    const staffId = session.id;

    // 同じメールアドレスの重複チェック
    const emailAddr = (data.email as string).trim();
    const duplicate = await prisma.operatingCompanyEmail.findFirst({
      where: { email: emailAddr, deletedAt: null },
    });
    if (duplicate) {
      return err(
        duplicate.operatingCompanyId === operatingCompanyId
          ? "このメールアドレスは既に登録されています"
          : "このメールアドレスは別の運営法人で既に登録されています"
      );
    }

    // smtpUser/imapUser はメールアドレスと同じ値を自動設定
    // imapPass は smtpPass と共通（アプリパスワード）
    const appPass = (data.smtpPass as string) || null;

    const email = await prisma.operatingCompanyEmail.create({
      data: {
        operatingCompanyId,
        email: emailAddr,
        label: (data.label as string) || null,
        smtpHost: (data.smtpHost as string) || null,
        smtpPort: data.smtpPort ? Number(data.smtpPort) : null,
        smtpUser: emailAddr,
        smtpPass: appPass,
        imapHost: (data.imapHost as string) || null,
        imapPort: data.imapPort ? Number(data.imapPort) : null,
        imapUser: emailAddr,
        imapPass: appPass,
        enableInbound: toBoolean(data.enableInbound),
        isDefault: toBoolean(data.isDefault),
        createdBy: staffId,
      },
    });

    // isDefaultがtrueの場合、同じ法人の他のメールのisDefaultをfalseにする
    if (email.isDefault) {
      await prisma.operatingCompanyEmail.updateMany({
        where: {
          operatingCompanyId,
          id: { not: email.id },
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }

    revalidatePath("/settings/operating-companies");
    return ok({
      id: email.id,
      operatingCompanyId: email.operatingCompanyId,
      email: email.email,
      label: email.label,
      smtpHost: email.smtpHost,
      smtpPort: email.smtpPort,
      smtpUser: email.smtpUser,
      hasSmtpPass: !!email.smtpPass,
      imapHost: email.imapHost,
      imapPort: email.imapPort,
      imapUser: email.imapUser,
      hasImapPass: !!email.imapPass,
      enableInbound: email.enableInbound,
      isDefault: email.isDefault,
    });
  } catch (e) {
    console.error("[addOperatingCompanyEmail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateOperatingCompanyEmail(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult<OperatingCompanyEmailDto>> {
  try {
    await requireMasterDataEditPermission();
    const session = await getSession();
    const staffId = session.id;

    const existing = await prisma.operatingCompanyEmail.findUnique({
      where: { id },
    });
    if (!existing) return err("メールアドレスが見つかりません");

    // メールアドレスが変更された場合の重複チェック
    const newEmailAddr = (data.email as string).trim();
    if (newEmailAddr !== existing.email) {
      const duplicate = await prisma.operatingCompanyEmail.findFirst({
        where: { email: newEmailAddr, deletedAt: null, id: { not: id } },
      });
      if (duplicate) {
        return err("このメールアドレスは既に使用されています");
      }
    }

    const isDefault = toBoolean(data.isDefault);

    // smtpUser/imapUser はメールアドレスと同じ値を自動設定
    const updateData: Record<string, unknown> = {
      email: newEmailAddr,
      label: (data.label as string) || null,
      smtpHost: (data.smtpHost as string) || null,
      smtpPort: data.smtpPort ? Number(data.smtpPort) : null,
      smtpUser: newEmailAddr,
      imapHost: (data.imapHost as string) || null,
      imapPort: data.imapPort ? Number(data.imapPort) : null,
      imapUser: newEmailAddr,
      enableInbound: toBoolean(data.enableInbound),
      isDefault,
      updatedBy: staffId,
    };

    // アプリパスワードが送信された場合のみ更新（SMTP/IMAP共通）
    if (data.smtpPass) {
      updateData.smtpPass = data.smtpPass as string;
      updateData.imapPass = data.smtpPass as string;
    }

    const email = await prisma.operatingCompanyEmail.update({
      where: { id },
      data: updateData,
    });

    // isDefaultがtrueの場合、同じ法人の他のメールのisDefaultをfalseにする
    if (isDefault) {
      await prisma.operatingCompanyEmail.updateMany({
        where: {
          operatingCompanyId: existing.operatingCompanyId,
          id: { not: email.id },
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }

    revalidatePath("/settings/operating-companies");
    return ok({
      id: email.id,
      operatingCompanyId: email.operatingCompanyId,
      email: email.email,
      label: email.label,
      smtpHost: email.smtpHost,
      smtpPort: email.smtpPort,
      smtpUser: email.smtpUser,
      hasSmtpPass: !!email.smtpPass,
      imapHost: email.imapHost,
      imapPort: email.imapPort,
      imapUser: email.imapUser,
      hasImapPass: !!email.imapPass,
      enableInbound: email.enableInbound,
      isDefault: email.isDefault,
    });
  } catch (e) {
    console.error("[updateOperatingCompanyEmail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteOperatingCompanyEmail(
  id: number
): Promise<ActionResult> {
  try {
    await requireMasterDataEditPermission();
    await prisma.operatingCompanyEmail.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/settings/operating-companies");
    return ok();
  } catch (e) {
    console.error("[deleteOperatingCompanyEmail] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
