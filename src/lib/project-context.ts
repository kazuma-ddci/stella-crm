// src/lib/project-context.ts
//
// SystemProjectBinding テーブルを参照し、route key に対応するプロジェクト情報を返す。
// キャッシュはアプリ再起動まで保持（設定データのため頻繁な変更は想定しない）。

import { prisma } from "@/lib/prisma";

export type SystemProjectCode = string;

export type ProjectContext = {
  projectId: number;
  costCenterIds: number[];
  projectName: string;
  defaultCostCenterId: number | null;
  operatingCompanyId: number | null;
};

/** キャッシュ付き: システムプロジェクト情報を取得 */
const _cache = new Map<string, ProjectContext>();

export async function getSystemProjectContext(
  code: SystemProjectCode
): Promise<ProjectContext> {
  const cached = _cache.get(code);
  if (cached) return cached;

  // SystemProjectBinding から取得
  const binding = await prisma.systemProjectBinding.findUnique({
    where: { routeKey: code },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (!binding) {
    throw new Error(`プロジェクト設定が見つかりません: ${code}`);
  }

  if (!binding.isActive) {
    throw new Error(`このプロジェクトは現在利用停止中です: ${code}`);
  }

  // CostCenterProjectAssignment から紐づくCostCenterを取得
  const assignments = await prisma.costCenterProjectAssignment.findMany({
    where: { projectId: binding.projectId },
    select: { costCenterId: true },
  });

  const result: ProjectContext = {
    projectId: binding.project.id,
    costCenterIds: assignments.map((a) => a.costCenterId),
    projectName: binding.project.name,
    defaultCostCenterId: binding.defaultCostCenterId,
    operatingCompanyId: binding.operatingCompanyId,
  };

  _cache.set(code, result);
  return result;
}

/** STP含有の按分テンプレートかどうかを判定 */
export function isTemplateContainingProject(
  template: { lines: { costCenterId: number | null }[] },
  projectCostCenterIds: number[]
): boolean {
  return template.lines.some(
    (line) =>
      line.costCenterId != null &&
      projectCostCenterIds.includes(line.costCenterId)
  );
}

/** 取引がプロジェクトスコープに属するかを検証 */
export async function validateTransactionScope(
  transactionId: number,
  projectCode: SystemProjectCode
): Promise<void> {
  const ctx = await getSystemProjectContext(projectCode);
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { projectId: true },
  });
  if (!tx) throw new Error("取引が見つかりません");
  if (tx.projectId !== ctx.projectId) {
    throw new Error("この取引はSTPプロジェクトに属していません");
  }
}
