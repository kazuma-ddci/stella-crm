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
 * SystemProjectBinding テーブルから routeKey に対応するプロジェクト情報を取得する。
 * 結果はプロセス内メモリにキャッシュされる（TTL: 5分）。
 *
 * @param routeKey - ルートキー（例: "stp"）
 * @returns ProjectContext or null（未登録または無効の場合）
 */
export async function getSystemProjectContext(
  routeKey: string
): Promise<ProjectContext | null> {
  // キャッシュ確認
  const cached = contextCache.get(routeKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // DB参照
  const binding = await prisma.systemProjectBinding.findUnique({
    where: { routeKey },
    include: {
      project: true,
      defaultCostCenter: true,
      operatingCompany: true,
    },
  });

  if (!binding || !binding.isActive) {
    contextCache.delete(routeKey);
    return null;
  }

  const context: ProjectContext = {
    projectId: binding.project.id,
    projectCode: binding.project.code,
    projectName: binding.project.name,
    defaultCostCenterId: binding.defaultCostCenter?.id ?? null,
    defaultCostCenterName: binding.defaultCostCenter?.name ?? null,
    operatingCompanyId: binding.operatingCompany?.id ?? null,
    operatingCompanyName: binding.operatingCompany?.companyName ?? null,
  };

  // キャッシュ保存
  contextCache.set(routeKey, {
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
    throw new Error("STPプロジェクトのコンテキストが取得できません。SystemProjectBindingの設定を確認してください。");
  }
  return ctx.projectId;
}

/**
 * キャッシュをクリアする（テスト用、設定変更後のリロード用）
 */
export function clearProjectContextCache(routeKey?: string): void {
  if (routeKey) {
    contextCache.delete(routeKey);
  } else {
    contextCache.clear();
  }
}
