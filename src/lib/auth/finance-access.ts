/**
 * 財務（finance）レイヤー用のレコード単位アクセスヘルパー。
 *
 * `src/lib/auth/staff-action.ts` の `requireStaffForFinance` は「入口の」粗い門番で、
 * "経理 OR 任意の事業PJ" の権限があれば通してしまう。これだけだと例えば STP staff が
 * HOJO の取引IDを直叩きで読めてしまう。
 *
 * 本ファイルの helper は、レコードの所属プロジェクトを実際にDBから引いて、
 * ユーザーがそのプロジェクト（または経理）に対する権限を持っているかを確認する。
 *
 * ## 設計原則
 *
 * - **lean**: 戻り値のレコードは最小フィールドのみ（`{ id, projectId, project: { code } }`）
 *   重い include が必要な場合は `src/app/finance/{module}/loaders.ts` の loader Server Action を使う
 * - **typed error**: 未存在は `FinanceRecordNotFoundError`、権限なしは `FinanceForbiddenError` を throw
 *   呼び出し元（page loader / Server Action / API route / client wrapper）で個別に変換する
 *   詳細パターンは docs/plans/archive/finance-accounting-refactor-plan.md §4.3.3 参照
 *
 * ## 使い方
 *
 * ```ts
 * // Server Action 内
 * export async function updateTransaction(id: number, data) {
 *   try {
 *     const { user } = await requireFinanceTransactionAccess(id, "edit");
 *     // ... 編集処理
 *     return ok();
 *   } catch (e) {
 *     if (e instanceof FinanceRecordNotFoundError) return err("取引が見つかりません");
 *     if (e instanceof FinanceForbiddenError) return err("この操作を行う権限がありません");
 *     return err("予期しないエラー");
 *   }
 * }
 * ```
 */

import { prisma } from "@/lib/prisma";
import { hasPermission, isFounder, isSystemAdmin } from "./permissions";
import { requireStaff } from "./staff-action";
import type { SessionUser, PermissionLevel, ProjectCode } from "@/types/auth";

// ============================================
// エラークラス
// ============================================

/** レコード未存在（404相当） */
export class FinanceRecordNotFoundError extends Error {
  constructor(
    public readonly recordType: string,
    public readonly recordId: number
  ) {
    super(`${recordType} (id=${recordId}) が見つかりません`);
    this.name = "FinanceRecordNotFoundError";
  }
}

/** 権限不足（403相当） */
export class FinanceForbiddenError extends Error {
  constructor(message = "このレコードへのアクセス権限がありません") {
    super(message);
    this.name = "FinanceForbiddenError";
  }
}

// ============================================
// 戻り値型
// ============================================

/**
 * 単一プロジェクトに紐づくレコードの最小情報（Transaction 等）。
 */
export type ProjectScopedRecord = {
  id: number;
  projectId: number | null;
  project: { code: string } | null;
};

/**
 * グループ系レコード（InvoiceGroup・PaymentGroup）の最小情報。
 *
 * **所有権は `group.projectId` のみで定義される**。子 Transaction は按分等で別PJに
 * 紐づくことがあるが、それは「グループに乗せた明細」であってグループ本体の所有権では
 * ない（Codex 最終レビュー指摘 P1-2 対応）。
 *
 * legacy レコード（projectId が null）は accounting 専用扱い。
 */
export type GroupScopedRecord = {
  id: number;
  projectId: number | null;
  project: { code: string } | null;
};

// ============================================
// 内部ロジック
// ============================================

/**
 * 単一プロジェクトのレコードに対するアクセス可否判定（共通基盤）。
 */
function checkProjectScopedAccess(
  record: ProjectScopedRecord,
  level: PermissionLevel,
  user: SessionUser
): boolean {
  if (isSystemAdmin(user) || isFounder(user)) return true;
  if (hasPermission(user.permissions, "accounting" as ProjectCode, level)) return true;

  const projectCode = record.project?.code as ProjectCode | undefined;
  if (projectCode && hasPermission(user.permissions, projectCode, level)) return true;

  // projectId が null のレガシーレコード → accounting 権限のみで判定（既に上で外れているので false）
  return false;
}

/**
 * グループ系レコード（InvoiceGroup・PaymentGroup）のアクセス可否判定。
 *
 * **group.projectId（所有権）のみで判定**（子取引の projectId は使わない、P1-2 対応）。
 * legacy レコード（projectId が null）は accounting 専用扱い。
 */
function checkGroupScopedAccess(
  record: GroupScopedRecord,
  level: PermissionLevel,
  user: SessionUser
): boolean {
  if (isSystemAdmin(user) || isFounder(user)) return true;
  if (hasPermission(user.permissions, "accounting" as ProjectCode, level)) return true;

  const projectCode = record.project?.code as ProjectCode | undefined;
  if (projectCode && hasPermission(user.permissions, projectCode, level)) return true;

  // projectId が null のレガシーレコード → accounting 権限のみで判定（既に上で外れているので false）
  return false;
}

// ============================================
// per-record helpers
// ============================================

/**
 * Transaction レコードへのアクセス可否を判定する。
 *
 * @throws {FinanceRecordNotFoundError} レコードが存在しない・論理削除済の場合
 * @throws {FinanceForbiddenError} ユーザーがレコードの所属PJに対する権限を持たない場合
 */
export async function requireFinanceTransactionAccess(
  transactionId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; transaction: ProjectScopedRecord }> {
  const user = await requireStaff();

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      project: { select: { code: true } },
    },
  });

  if (!transaction) {
    throw new FinanceRecordNotFoundError("Transaction", transactionId);
  }

  if (!checkProjectScopedAccess(transaction, level, user)) {
    throw new FinanceForbiddenError();
  }

  return { user, transaction };
}

/**
 * InvoiceGroup レコードへのアクセス可否を判定する。
 *
 * **group.projectId（所有権）のみで判定**（子取引の projectId は使わない、Codex P1-2 対応）。
 * 按分で別PJの子取引が乗っていても、グループ本体の所有権は group.projectId。
 *
 * @throws {FinanceRecordNotFoundError}
 * @throws {FinanceForbiddenError}
 */
export async function requireFinanceInvoiceGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; invoiceGroup: GroupScopedRecord }> {
  const user = await requireStaff();

  const group = await prisma.invoiceGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      project: { select: { code: true } },
    },
  });

  if (!group) {
    throw new FinanceRecordNotFoundError("InvoiceGroup", groupId);
  }

  const record: GroupScopedRecord = {
    id: group.id,
    projectId: group.projectId,
    project: group.project,
  };

  if (!checkGroupScopedAccess(record, level, user)) {
    throw new FinanceForbiddenError();
  }

  return { user, invoiceGroup: record };
}

/**
 * PaymentGroup レコードへのアクセス可否を判定する。
 *
 * **group.projectId（所有権）のみで判定**（子取引の projectId は使わない、Codex P1-2 対応）。
 *
 * @throws {FinanceRecordNotFoundError}
 * @throws {FinanceForbiddenError}
 */
export async function requireFinancePaymentGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; paymentGroup: GroupScopedRecord }> {
  const user = await requireStaff();

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      project: { select: { code: true } },
    },
  });

  if (!group) {
    throw new FinanceRecordNotFoundError("PaymentGroup", groupId);
  }

  const record: GroupScopedRecord = {
    id: group.id,
    projectId: group.projectId,
    project: group.project,
  };

  if (!checkGroupScopedAccess(record, level, user)) {
    throw new FinanceForbiddenError();
  }

  return { user, paymentGroup: record };
}

/**
 * プロジェクトIDへのアクセス可否を判定する（recordIdを取らない関数で使う）。
 *
 * @throws {FinanceRecordNotFoundError} 指定 projectId のプロジェクトが存在しない場合
 * @throws {FinanceForbiddenError}
 */
export async function requireFinanceProjectAccess(
  projectId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; projectCode: string }> {
  const user = await requireStaff();

  const project = await prisma.masterProject.findUnique({
    where: { id: projectId },
    select: { code: true },
  });

  if (!project) {
    throw new FinanceRecordNotFoundError("MasterProject", projectId);
  }

  if (isSystemAdmin(user) || isFounder(user)) {
    return { user, projectCode: project.code };
  }
  if (hasPermission(user.permissions, "accounting" as ProjectCode, level)) {
    return { user, projectCode: project.code };
  }
  if (hasPermission(user.permissions, project.code as ProjectCode, level)) {
    return { user, projectCode: project.code };
  }

  throw new FinanceForbiddenError();
}

/**
 * プロジェクトコード（string | null）ベースのアクセス可否判定。
 *
 * - `projectCode === null` → accounting 権限が必要（accounting エントリ専用フォーム等）
 * - `projectCode` 指定 → accounting OR 該当プロジェクトの権限
 *
 * `getExpenseFormData(projectCode: string | null)` 等、現状のシグネチャ
 * （projectCode を直接受け取る）に合わせるための専用helper。
 *
 * @throws {FinanceForbiddenError}
 */
export async function requireFinanceProjectCodeAccess(
  projectCode: string | null,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser }> {
  const user = await requireStaff();

  if (isSystemAdmin(user) || isFounder(user)) {
    return { user };
  }
  if (hasPermission(user.permissions, "accounting" as ProjectCode, level)) {
    return { user };
  }
  if (projectCode && hasPermission(user.permissions, projectCode as ProjectCode, level)) {
    return { user };
  }

  throw new FinanceForbiddenError();
}

/**
 * PaymentGroup の「プロジェクト承認」権限を判定する。
 *
 * 通すケース:
 * - ファウンダー / システム管理者
 * - そのグループの `approverStaffId === user.id`（指名された承認者）
 *
 * ⚠️ 現状の auth モデルでは UserPermission に `canApprove` フラグが存在するが、
 *    実コードの `approveByProjectApprover` では使われておらず、`approverStaffId` のみで判定。
 *    本helperもそれに合わせる（`canApprove` は将来的な拡張用）。
 *
 * @throws {FinanceRecordNotFoundError}
 * @throws {FinanceForbiddenError}
 */
export async function requireFinancePaymentGroupApprovalAccess(
  groupId: number
): Promise<{
  user: SessionUser;
  paymentGroup: { id: number; approverStaffId: number | null; status: string };
}> {
  const user = await requireStaff();

  const group = await prisma.paymentGroup.findFirst({
    where: { id: groupId, deletedAt: null },
    select: { id: true, approverStaffId: true, status: true },
  });

  if (!group) {
    throw new FinanceRecordNotFoundError("PaymentGroup", groupId);
  }

  if (isSystemAdmin(user) || isFounder(user)) {
    return { user, paymentGroup: group };
  }
  if (group.approverStaffId === user.id) {
    return { user, paymentGroup: group };
  }

  throw new FinanceForbiddenError("あなたはこのグループの承認者ではありません");
}
