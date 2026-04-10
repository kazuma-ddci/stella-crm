"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectMasterDataEditPermission } from "@/lib/auth/master-data-permission";
import { toBoolean } from "@/lib/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function addContractType(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const projectId = Number(data.projectId);

    // 同プロジェクト内の最大表示順を取得して+1
    const maxOrder = await prisma.contractType.aggregate({
      where: { projectId },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    await prisma.contractType.create({
      data: {
        projectId,
        name: data.name as string,
        description: (data.description as string) || null,
        displayOrder,
        isActive: toBoolean(data.isActive),
      },
    });
    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[addContractType] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateContractType(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    const updateData: Record<string, unknown> = {};
    if ("projectId" in data) updateData.projectId = Number(data.projectId);
    if ("name" in data) updateData.name = data.name as string;
    if ("description" in data) updateData.description = (data.description as string) || null;
    if ("isActive" in data) updateData.isActive = toBoolean(data.isActive);

    if (Object.keys(updateData).length > 0) {
      await prisma.contractType.update({
        where: { id },
        data: updateData,
      });
    }
    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[updateContractType] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteContractType(id: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();
    await prisma.contractType.delete({
      where: { id },
    });
    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[deleteContractType] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function reorderContractTypes(
  orderedIds: number[]
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    const contractTypes = await prisma.contractType.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true, projectId: true },
    });

    const idToProjectId = new Map(contractTypes.map((ct) => [ct.id, ct.projectId]));

    // プロジェクトごとにカウンターを管理
    const projectCounters = new Map<number, number>();

    await prisma.$transaction(
      orderedIds.map((id) => {
        const projectId = idToProjectId.get(id)!;
        const currentOrder = (projectCounters.get(projectId) ?? 0) + 1;
        projectCounters.set(projectId, currentOrder);

        return prisma.contractType.update({
          where: { id },
          data: { displayOrder: currentOrder },
        });
      })
    );

    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[reorderContractTypes] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// テンプレート紐づけ管理
// ============================================

/**
 * 契約種別に紐づくテンプレート一覧を取得
 * 各テンプレートが他の契約種別でも使われているかの情報も返す
 */
export async function getLinkedTemplates(contractTypeId: number) {
  const links = await prisma.cloudSignTemplateContractType.findMany({
    where: { contractTypeId },
    include: {
      template: {
        include: {
          operatingCompany: {
            select: { companyName: true },
          },
          contractTypes: {
            where: { contractTypeId: { not: contractTypeId } },
            include: {
              contractType: {
                select: { name: true, project: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return links.map((l) => ({
    linkId: l.id,
    templateId: l.template.id,
    cloudsignTemplateId: l.template.cloudsignTemplateId,
    name: l.template.name,
    description: l.template.description,
    operatingCompanyName: l.template.operatingCompany.companyName,
    // 他の契約種別（同じプロジェクトか別プロジェクトか問わず）での紐付け
    otherContractTypes: l.template.contractTypes.map((c) => ({
      name: c.contractType.name,
      projectName: c.contractType.project.name,
    })),
  }));
}

/**
 * テンプレートの名前・説明を更新
 * 注意: 同じテンプレートが他の契約種別で共有されている場合、そちらにも反映されます
 */
export async function updateTemplate(
  templateId: number,
  input: { name: string; description: string | null }
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    if (!input.name.trim()) {
      return err("テンプレート名を入力してください");
    }

    await prisma.cloudSignTemplate.update({
      where: { id: templateId },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });

    revalidatePath("/settings/contract-types");
    revalidatePath("/slp/settings/project");
    return ok();
  } catch (e) {
    console.error("[updateTemplate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * テンプレートを契約種別に紐づける
 * - テンプレートが未登録なら新規作成してから紐づけ
 * - 既存なら紐づけのみ追加
 * - 運営法人の整合性チェック付き
 */
export async function addTemplateLink(
  contractTypeId: number,
  input: {
    cloudsignTemplateId: string;
    name: string;
    description: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    // 契約種別のプロジェクト → 運営法人を取得
    const contractType = await prisma.contractType.findUnique({
      where: { id: contractTypeId },
      include: {
        project: {
          include: {
            operatingCompany: { select: { id: true, companyName: true } },
          },
        },
      },
    });

    if (!contractType) {
      return err("契約種別が見つかりません");
    }

    const operatingCompanyId = contractType.project.operatingCompanyId;
    if (!operatingCompanyId) {
      return err("この契約種別のプロジェクトに運営法人が設定されていません");
    }

    // 同じ運営法人で同じテンプレートIDが既に登録されているか確認
    let template = await prisma.cloudSignTemplate.findUnique({
      where: {
        operatingCompanyId_cloudsignTemplateId: {
          operatingCompanyId,
          cloudsignTemplateId: input.cloudsignTemplateId,
        },
      },
    });

    if (!template) {
      // テンプレートマスタに新規登録
      template = await prisma.cloudSignTemplate.create({
        data: {
          operatingCompanyId,
          cloudsignTemplateId: input.cloudsignTemplateId,
          name: input.name,
          description: input.description,
        },
      });
    }

    // 既に紐づいていないか確認
    const existing = await prisma.cloudSignTemplateContractType.findUnique({
      where: {
        templateId_contractTypeId: {
          templateId: template.id,
          contractTypeId,
        },
      },
    });

    if (existing) {
      return err("このテンプレートは既に紐づいています");
    }

    // 紐づけを作成
    await prisma.cloudSignTemplateContractType.create({
      data: {
        templateId: template.id,
        contractTypeId,
      },
    });

    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[addTemplateLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * テンプレート紐づけを解除（中間テーブルのレコード削除）
 */
export async function removeTemplateLink(linkId: number): Promise<ActionResult> {
  try {
    await requireProjectMasterDataEditPermission();

    await prisma.cloudSignTemplateContractType.delete({
      where: { id: linkId },
    });

    revalidatePath("/settings/contract-types");
    return ok();
  } catch (e) {
    console.error("[removeTemplateLink] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
