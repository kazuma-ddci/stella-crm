/**
 * Server Action 用の統一エラー返却型。
 *
 * ## 背景
 *
 * Next.js の本番ビルドでは、Server Action 内で `throw new Error("日本語メッセージ")`
 * した場合、client に届くエラーメッセージがセキュリティ上の理由で自動的に
 * "An error occurred in the Server Components render..." という英語汎用文言に
 * 置き換えられてしまう（https://nextjs.org/docs/app/getting-started/error-handling）。
 *
 * 結果、ユーザーには「どの項目が問題なのか」「何をすれば解決するのか」が
 * 全く伝わらず、スタッフが操作不能に陥る。
 *
 * ## 解決方針
 *
 * Server Action は `throw` せず、本ファイルの `ActionResult<T>` を返す形に統一する。
 * エラーメッセージが「値」として返されるため、Next.js のサニタイズ対象にならない。
 *
 * ## 使い方（Server Action 側）
 *
 * ```ts
 * "use server";
 * import { ok, err, type ActionResult } from "@/lib/action-result";
 *
 * export async function createItem(data: FormData): Promise<ActionResult<{ id: number }>> {
 *   try {
 *     if (!data.name) return err("名前は必須です");
 *     const existing = await prisma.item.findUnique({ where: { name: data.name } });
 *     if (existing) return err(`「${data.name}」は既に存在します`);
 *     const created = await prisma.item.create({ data });
 *     return ok({ id: created.id });
 *   } catch (e) {
 *     console.error("[createItem] unexpected error:", e);
 *     return err("予期しないエラーが発生しました");
 *   }
 * }
 * ```
 *
 * ## 使い方（Client 側）
 *
 * CrudTable 経由の場合は **呼び出し側の変更は不要**（crud-table.tsx が
 * 自動的に `ActionResult` を検知して `toast.error` する）。
 *
 * カスタムフォームから呼ぶ場合は以下のように:
 * ```tsx
 * const result = await createItem(data);
 * if (!result.ok) {
 *   toast.error(result.error);
 *   return;
 * }
 * // result.data が使える
 * ```
 *
 * または `unwrapAction` ヘルパーで throw に変換（client 側の throw は
 * サニタイズされないので安全）:
 * ```tsx
 * try {
 *   const data = unwrapAction(await createItem(input));
 *   // ...
 * } catch (e) {
 *   // e.message は日本語のまま
 * }
 * ```
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** 成功結果を生成 */
export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

/** エラー結果を生成 */
export function err(message: string): ActionResult<never> {
  return { ok: false, error: message };
}

/**
 * 値が ActionResult 形式かどうかを判定する型ガード。
 * crud-table 等の汎用呼び出し側でレガシー（void 返却）と新形式を
 * 区別するために使用。
 */
export function isActionResult(value: unknown): value is ActionResult<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}

/**
 * ActionResult を unwrap して、エラーなら throw する。
 * Client 側で throw すれば Next.js のサニタイズは発生しないため、
 * メッセージは保持される。
 */
export function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Server Action 実装を try-catch で包む高階関数。
 *
 * 既存の throw ベースの実装を最小変更で ActionResult 形式に変換できる。
 * 本番モードでも throw はサーバー側（関数境界の外に出る前）で捕捉されるので
 * サニタイズされない。
 *
 * ```ts
 * export const addItem = wrapAction(async (data: FormData) => {
 *   if (!data.name) throw new Error("名前は必須です");
 *   return await prisma.item.create({ data });
 * });
 * // 型: (data: FormData) => Promise<ActionResult<Item>>
 * ```
 *
 * ※ Next.js の "use server" ディレクティブとの互換性を保つため、
 *   ラップした結果を `export const` で直接 export する。
 */
export function wrapAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>
): (...args: A) => Promise<ActionResult<R>> {
  return async (...args: A): Promise<ActionResult<R>> => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (e) {
      console.error("[wrapAction] caught error:", e);
      const error =
        e instanceof Error ? e.message : "予期しないエラーが発生しました";
      return { ok: false, error };
    }
  };
}
