import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { SessionUser, ProjectCode } from "@/types/auth";
import { canEdit, isManager, isFounder, isSystemAdmin } from "./permissions";

export async function getSession(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function getOptionalSession(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * 指定プロジェクトの編集権限（edit以上）を要求する。
 * 権限がない場合はエラーをスローする。
 * Server Actionsの更新系処理の先頭で使用する。
 */
export async function requireEdit(projectCode: ProjectCode): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("認証が必要です");
  }
  const user = session.user;
  if (!canEdit(user.permissions, projectCode)) {
    throw new Error("この操作を行う権限がありません");
  }
  return user;
}

/**
 * 指定プロジェクトのmanager権限（またはfounder/admin）を要求する。
 * スタッフ管理やPJ固有固定データ設定で使用。
 */
export async function requireManager(projectCode: ProjectCode): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("認証が必要です");
  }
  const user = session.user;
  if (isSystemAdmin(user) || isFounder(user) || isManager(user.permissions, projectCode)) {
    return user;
  }
  throw new Error("この操作を行う権限がありません");
}
