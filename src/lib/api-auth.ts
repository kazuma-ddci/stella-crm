import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth/permissions";
import type { SessionUser, ProjectCode, PermissionLevel } from "@/types/auth";

/**
 * API route 用の認証/認可ヘルパー。
 *
 * ## 使い方
 *
 * ### 1. 「ログイン中の社内スタッフなら誰でも可」
 * ```ts
 * const authz = await authorizeApi();
 * if (!authz.ok) return authz.response;
 * // authz.user は SessionUser
 * ```
 *
 * ### 2. 「指定プロジェクトのいずれかで指定権限以上を持つスタッフのみ可」(OR条件)
 * ```ts
 * const authz = await authorizeApi([
 *   { project: "stp", level: "edit" },
 *   { project: "accounting", level: "edit" },
 * ]);
 * if (!authz.ok) return authz.response;
 * ```
 *
 * ## 動作
 *
 * - 未認証 → 401
 * - userType !== "staff" (external/bbs/vendor/lender) → 403
 * - projects 指定あり、いずれにも該当しない → 403
 * - 全てクリア → `{ ok: true, user }`
 */
export type ApiAuthorizeResult =
  | { ok: true; user: SessionUser; response?: never }
  | { ok: false; user?: never; response: NextResponse };

export async function authorizeApi(
  projects?: Array<{ project: ProjectCode; level: PermissionLevel }>
): Promise<ApiAuthorizeResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "認証が必要です" }, { status: 401 }),
    };
  }

  // SessionUser 型に詰め替え (next-auth の型と CRM 内部の型のギャップを埋める)
  const user = session.user as unknown as SessionUser;

  if (user.userType !== "staff") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "社内スタッフのみアクセス可能です" },
        { status: 403 }
      ),
    };
  }

  if (projects && projects.length > 0) {
    const allowed = projects.some((p) =>
      hasPermission(user.permissions ?? [], p.project, p.level)
    );
    if (!allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "この操作を行う権限がありません" },
          { status: 403 }
        ),
      };
    }
  }

  return { ok: true, user };
}
