import { prisma } from "@/lib/prisma";

// ============================================
// プロジェクトコンテキスト型定義
// ============================================

export type ProjectContext = {
  projectId: number;
  projectCode: string;
  projectName: string;
  defaultCostCenterId: number | null;
  defaultCostCenterName: string | null;
  operatingCompanyId: number | null;
  operatingCompanyName: string | null;
};

// ============================================
// キャッシュ（プロセス内メモリ）
// ============================================

const contextCache = new Map<string, { data: ProjectContext; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

// ============================================
// メイン関数
// ============================================

/**
 * MasterProject テーブルから code に対応するプロジェクト情報を取得する。
 * 結果はプロセス内メモリにキャッシュされる（TTL: 5分）。
 *
 * @param projectCode - プロジェクトコード（例: "stp"）
 * @returns ProjectContext or null（未登録または無効の場合）
 */
export async function getSystemProjectContext(
  projectCode: string
): Promise<ProjectContext | null> {
  // キャッシュ確認
  const cached = contextCache.get(projectCode);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // DB参照
  const project = await prisma.masterProject.findUnique({
    where: { code: projectCode },
    include: {
      defaultCostCenter: true,
      operatingCompany: true,
    },
  });

  if (!project || !project.isActive) {
    contextCache.delete(projectCode);
    return null;
  }

  const context: ProjectContext = {
    projectId: project.id,
    projectCode: project.code,
    projectName: project.name,
    defaultCostCenterId: project.defaultCostCenter?.id ?? null,
    defaultCostCenterName: project.defaultCostCenter?.name ?? null,
    operatingCompanyId: project.operatingCompany?.id ?? null,
    operatingCompanyName: project.operatingCompany?.companyName ?? null,
  };

  // キャッシュ保存
  contextCache.set(projectCode, {
    data: context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return context;
}

/**
 * STPプロジェクトの projectId をサーバー側で取得する（fail-closed）。
 * コンテキストが取得できない場合はエラーを投げる。
 */
export async function requireStpProjectId(): Promise<number> {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) {
    throw new Error("STPプロジェクトのコンテキストが取得できません。MasterProjectの設定を確認してください。");
  }
  return ctx.projectId;
}

/**
 * キャッシュをクリアする（テスト用、設定変更後のリロード用）
 */
export function clearProjectContextCache(projectCode?: string): void {
  if (projectCode) {
    contextCache.delete(projectCode);
  } else {
    contextCache.clear();
  }
}
