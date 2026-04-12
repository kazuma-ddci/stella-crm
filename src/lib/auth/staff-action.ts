import { getSession } from "@/lib/auth";
import type { SessionUser, ProjectCode, PermissionLevel } from "@/types/auth";

/**
 * Server Action 用の認証/認可ヘルパー。
 *
 * `getSession()` を呼び、その上で以下のチェックを実施:
 *
 * 1. **userType が "staff" か** — 外部ユーザー(external/bbs/vendor/lender)は弾く
 * 2. **指定された projects のいずれかで指定 level 以上の権限を持つか** — OR条件
 *
 * いずれかに失敗すれば throw する。throw された Error は呼び出し元の
 * try/catch で `err()` に変換することを想定。
 *
 * ## 注意
 *
 * `getSession()` は未認証時に `redirect("/login")` を呼ぶ(Next.js の throw)。
 * このヘルパーを呼び出す Server Action は **try/catch の外で呼ぶ** か、
 * catch 内で redirect エラーを再 throw する必要がある(本プロジェクトでは
 * 単純化のため try の外で呼ぶ運用を推奨)。
 *
 * ## 使い方
 *
 * ```ts
 * export async function deleteCompany(id: number): Promise<ActionResult> {
 *   // try/catch の外で呼ぶ → 未認証なら /login へリダイレクト
 *   const user = await requireStaffWithAnyEditPermission();
 *   try {
 *     // ... DB 操作
 *     return ok();
 *   } catch (e) {
 *     return err(e instanceof Error ? e.message : "失敗しました");
 *   }
 * }
 * ```
 *
 * ## バリエーション
 *
 * - `requireStaff()` — staff であることだけ確認(プロジェクト権限不問)
 * - `requireStaffWithAnyEditPermission()` — いずれかの project で edit 以上
 * - `requireStaffWithProjectPermission(projects)` — 指定 project の OR 条件
 */

/** ログイン中の社内スタッフであることを確認する。 */
export async function requireStaff(): Promise<SessionUser> {
  const session = await getSession();
  if (session.userType !== "staff") {
    throw new Error("社内スタッフのみ実行可能です");
  }
  return session;
}

/** ログイン中の社内スタッフ + いずれかのプロジェクトで edit 以上の権限を持つことを確認する。 */
export async function requireStaffWithAnyEditPermission(): Promise<SessionUser> {
  const session = await requireStaff();
  const editLevels: PermissionLevel[] = ["edit", "manager"];
  const hasAny = (session.permissions ?? []).some((p) =>
    editLevels.includes(p.permissionLevel as PermissionLevel)
  );
  if (!hasAny) {
    throw new Error("いずれかのプロジェクトの編集権限が必要です");
  }
  return session;
}

/**
 * ログイン中の社内スタッフ + 指定 project のいずれかで指定 level 以上の権限を持つことを確認する。
 * OR条件で評価。
 */
export async function requireStaffWithProjectPermission(
  projects: Array<{ project: ProjectCode; level: PermissionLevel }>
): Promise<SessionUser> {
  const session = await requireStaff();

  const levelOrder: Record<PermissionLevel, number> = {
    none: 0,
    view: 1,
    edit: 2,
    manager: 3,
  };

  const ok = projects.some((p) => {
    const userPerm = (session.permissions ?? []).find(
      (up) => up.projectCode === p.project
    );
    if (!userPerm) return false;
    return (
      (levelOrder[userPerm.permissionLevel as PermissionLevel] ?? 0) >=
      (levelOrder[p.level] ?? 0)
    );
  });

  if (!ok) {
    throw new Error("この操作を行う権限がありません");
  }
  return session;
}
