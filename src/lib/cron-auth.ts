import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Cron route の Bearer 認証チェック共通ヘルパー。
 *
 * ## 動作
 * - `CRON_SECRET` 環境変数が未設定 → 500 (fail-secure)
 * - `Authorization: Bearer <secret>` ヘッダーが一致しなければ 401
 * - 比較は `crypto.timingSafeEqual` を使用してタイミング攻撃に耐性を持たせる
 *
 * ## 使い方
 * ```ts
 * import { verifyCronAuth } from "@/lib/cron-auth";
 *
 * export async function GET(request: Request) {
 *   const authError = verifyCronAuth(request);
 *   if (authError) return authError;
 *   // ... 本処理
 * }
 * ```
 */
export function verifyCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);

  // 長さが違う時点で不一致確定。timingSafeEqual は同じ長さでないと throw するため
  // 先に長さチェックして短絡評価する。
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
