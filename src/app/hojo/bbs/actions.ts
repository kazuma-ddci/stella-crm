"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import bcrypt from "bcryptjs";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { parseYmdDate } from "@/lib/hojo/parse-date";

const REVALIDATE_PATH = "/hojo/bbs";

async function requireBbsEditPermission(): Promise<void> {
  const session = await auth();
  const userType = session?.user?.userType;
  if (userType === "bbs") return; // BBSユーザーは編集可
  if (userType === "staff") {
    const permissions = (session?.user?.permissions ?? []) as UserPermission[];
    if (canEditProject(permissions, "hojo")) return; // スタッフのhojo edit以上も編集可
  }
  throw new Error("権限がありません");
}

export async function registerBbsAccount(data: {
  name: string;
  email: string;
  password: string;
}): Promise<ActionResult> {
  try {
    const { name, email, password } = data;

    if (!name.trim() || !email.trim() || !password.trim()) {
      return err("すべての項目を入力してください");
    }
    if (password.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    // メールアドレスの重複チェック（BBS、スタッフ、外部ユーザー全体で）
    const existingBbs = await prisma.hojoBbsAccount.findUnique({
      where: { email: email.trim() },
    });
    if (existingBbs) {
      return err("このメールアドレスは既に登録されています");
    }
    const existingStaff = await prisma.masterStaff.findUnique({
      where: { email: email.trim() },
    });
    if (existingStaff) {
      return err("このメールアドレスは既に使用されています");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.hojoBbsAccount.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
      },
    });
    return ok();
  } catch (e) {
    console.error("[registerBbsAccount] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loginBbsAccount(email: string, _password: string) {
  const account = await prisma.hojoBbsAccount.findUnique({
    where: { email },
  });

  if (!account) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  if (account.status === "pending_approval") {
    return { error: "アカウントは認証待ちです。しばらくお待ちください" };
  }

  if (account.status === "suspended") {
    return { error: "アカウントが停止されています" };
  }

  return { success: true };
}

export async function recordPasswordResetRequest(email: string) {
  const account = await prisma.hojoBbsAccount.findUnique({
    where: { email },
  });
  if (account) {
    await prisma.hojoBbsAccount.update({
      where: { id: account.id },
      data: { passwordResetRequestedAt: new Date() },
    });
  }
}

export type BbsEditableFields = {
  bbsStatusId?: number | null;
  bbsMemo?: string;
  applicationFormDate?: string | null;
};

// 各フィールドの Prisma への変換ロジック。追加時はここに1行足すだけ。
const BBS_FIELD_CONVERTERS: {
  [K in keyof BbsEditableFields]: (v: NonNullable<BbsEditableFields[K]>) => unknown;
} = {
  bbsStatusId: (v) => v || null,
  bbsMemo: (v) => v || null,
  applicationFormDate: (v) => parseYmdDate(v as string | null),
};

export async function updateBbsFields(
  applicationSupportId: number,
  data: BbsEditableFields
): Promise<ActionResult> {
  try {
    await requireBbsEditPermission();
    const updateData: Record<string, unknown> = {};

    for (const key of Object.keys(BBS_FIELD_CONVERTERS) as (keyof BbsEditableFields)[]) {
      const value = data[key];
      if (value === undefined) continue;
      const converter = BBS_FIELD_CONVERTERS[key] as (v: unknown) => unknown;
      updateData[key] = converter(value);
    }

    if (Object.keys(updateData).length === 0) return ok();

    await prisma.hojoApplicationSupport.update({
      where: { id: applicationSupportId },
      data: updateData,
    });

    // BBSが編集した applicationFormDate は社内申請者管理にも表示されるため両方を revalidate
    revalidatePath(REVALIDATE_PATH);
    revalidatePath("/hojo/application-support");
    return ok();
  } catch (e) {
    console.error("[updateBbsFields] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function changeBbsPassword(
  accountId: number,
  newPassword: string
): Promise<ActionResult> {
  // 認証: BBSユーザー本人の自己変更のみ許可。
  // 他人の accountId を指定された場合は拒否する。
  // スタッフによるリセットは hojo/settings/partner-accounts/actions.ts:resetBbsPassword を使う。
  const session = await auth();
  if (!session?.user) {
    return err("認証が必要です");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = (session.user as any).userType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionBbsAccountId = (session.user as any).bbsAccountId as number | undefined;
  if (userType !== "bbs" || sessionBbsAccountId !== accountId) {
    return err("自分のアカウント以外のパスワードは変更できません");
  }

  try {
    if (newPassword.length < 8) {
      return err("パスワードは8文字以上にしてください");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.hojoBbsAccount.update({
      where: { id: accountId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
    return ok();
  } catch (e) {
    console.error("[changeBbsPassword] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

