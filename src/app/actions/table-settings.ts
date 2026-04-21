"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";

type TableSetting = {
  stickyLeftCount?: number;
};

// tableId に使える文字を制限（SQL injection 対策 + キー命名統制）
const TABLE_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * ログイン中スタッフの tableSettings JSON を部分更新する。
 *
 * PostgreSQL の jsonb_set を使って**指定 tableId のキーだけを**原子的に更新するため、
 * 同一スタッフが複数タブで別 tableId を同時に変更しても lost update が発生しない。
 */
export async function updateTableSetting(
  tableId: string,
  setting: TableSetting,
): Promise<ActionResult> {
  const session = await auth();
  const user = session?.user;
  if (!user || user.userType !== "staff") {
    return err("この操作はログイン中のスタッフのみ可能です");
  }
  if (!TABLE_ID_PATTERN.test(tableId)) {
    return err("無効なテーブルIDです");
  }
  try {
    const staffId = user.id as number;
    // jsonb_set で該当 tableId のサブキーのみ更新。既存の他 tableId 設定は保持される
    await prisma.$executeRaw`
      UPDATE "master_staff"
      SET "table_settings" = jsonb_set(
        COALESCE("table_settings", '{}'::jsonb),
        ARRAY[${tableId}]::text[],
        ${JSON.stringify(setting)}::jsonb,
        true
      )
      WHERE "id" = ${staffId}
    `;
    return ok();
  } catch (e) {
    console.error("[updateTableSetting] error:", e);
    return err(
      e instanceof Error ? e.message : "テーブル設定の保存に失敗しました",
    );
  }
}
