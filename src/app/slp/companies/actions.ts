"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  submitForm10BriefingComplete,
  submitForm11BriefingThankYou,
  submitForm13ConsultationThankYou,
  addBriefingCompleteTag,
  removeBriefingCompleteTag,
  addConsultationCompleteTag,
  removeConsultationCompleteTag,
} from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import { auth } from "@/auth";
import { recomputeDuplicateCandidatesForRecord } from "@/lib/slp/duplicate-detector";
import { ok, err, type ActionResult } from "@/lib/action-result";

/** タグ操作の結果型 */
export type TagResult = {
  contactId: number;
  name: string;
  uid: string;
  success: boolean;
  error?: string;
};

/** タグ種類: "briefing-complete"=概要案内完了, "consultation-complete"=導入希望商談完了 */
export type TagType = "briefing-complete" | "consultation-complete";

const TAG_LABELS: Record<TagType, string> = {
  "briefing-complete": "概要案内完了",
  "consultation-complete": "導入希望商談完了",
};

function getTagApi(tagType: TagType, action: "add" | "remove") {
  if (tagType === "briefing-complete") {
    return action === "add" ? addBriefingCompleteTag : removeBriefingCompleteTag;
  }
  return action === "add" ? addConsultationCompleteTag : removeConsultationCompleteTag;
}

function getTagSource(tagType: TagType, action: "add" | "remove") {
  if (tagType === "briefing-complete") {
    return action === "add" ? "slp-tag-briefing-complete-add" : "slp-tag-briefing-complete-remove";
  }
  return action === "add" ? "slp-tag-consultation-complete-add" : "slp-tag-consultation-complete-remove";
}

function getTagRetryAction(tagType: TagType, action: "add" | "remove") {
  if (tagType === "briefing-complete") {
    return action === "add" ? "tag-briefing-complete-add" : "tag-briefing-complete-remove";
  }
  return action === "add" ? "tag-consultation-complete-add" : "tag-consultation-complete-remove";
}

/**
 * 指定企業の全担当者（公式LINE紐付けあり）に対してタグ付与/削除を実行する。
 * 各担当者の結果を配列で返す。失敗時は automation_errors にも記録する。
 */
async function applyTagToAllContacts(
  recordId: number,
  action: "add" | "remove",
  tagType: TagType
): Promise<TagResult[]> {
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { companyRecordId: recordId },
    include: { lineFriend: { select: { uid: true, snsname: true } } },
  });

  const tagApi = getTagApi(tagType, action);
  const tagLabel = TAG_LABELS[tagType];

  const results: TagResult[] = [];
  for (const c of contacts) {
    const uid = c.lineFriend?.uid;
    if (!uid) continue; // LINE未紐付けはスキップ
    const displayName = c.name ?? c.lineFriend?.snsname ?? "(名前なし)";
    try {
      await tagApi(uid);
      results.push({ contactId: c.id, name: displayName, uid, success: true });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ contactId: c.id, name: displayName, uid, success: false, error: errMsg });
      await logAutomationError({
        source: getTagSource(tagType, action),
        message: `${tagLabel}タグ${action === "add" ? "付与" : "削除"}失敗: ${displayName} (uid=${uid})`,
        detail: {
          error: errMsg,
          uid,
          contactId: c.id,
          name: displayName,
          retryAction: getTagRetryAction(tagType, action),
        },
      });
    }
  }
  return results;
}

/** 単一担当者に対してタグ操作を実行 */
async function applyTagToContact(
  contactId: number,
  action: "add" | "remove",
  tagType: TagType
): Promise<TagResult | null> {
  const contact = await prisma.slpCompanyContact.findUnique({
    where: { id: contactId },
    include: { lineFriend: { select: { uid: true, snsname: true } } },
  });
  if (!contact) return null;
  const uid = contact.lineFriend?.uid;
  if (!uid) return null;
  const displayName = contact.name ?? contact.lineFriend?.snsname ?? "(名前なし)";

  const tagApi = getTagApi(tagType, action);
  const tagLabel = TAG_LABELS[tagType];

  try {
    await tagApi(uid);
    return { contactId, name: displayName, uid, success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await logAutomationError({
      source: getTagSource(tagType, action),
      message: `${tagLabel}タグ${action === "add" ? "付与" : "削除"}失敗: ${displayName} (uid=${uid})`,
      detail: {
        error: errMsg,
        uid,
        contactId,
        name: displayName,
        retryAction: getTagRetryAction(tagType, action),
      },
    });
    return { contactId, name: displayName, uid, success: false, error: errMsg };
  }
}

async function getCurrentStaffId(): Promise<number | null> {
  const session = await auth();
  const id = (session?.user as { id?: number | string } | undefined)?.id;
  if (typeof id === "number") return id;
  if (typeof id === "string") {
    const parsed = parseInt(id, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// ========================================
// 企業名簿 CRUD
// ========================================

export async function addCompanyRecord(input: {
  businessType: string;
  companyName: string;
}): Promise<{ id: number }> {
  const created = await prisma.slpCompanyRecord.create({
    data: {
      businessType: input.businessType,
      companyName: input.companyName.trim() || null,
    },
  });
  // 重複候補を再計算（fire-and-forget）
  recomputeDuplicateCandidatesForRecord(created.id).catch(async (err) => {
    await logAutomationError({
      source: "slp-recompute-duplicates",
      message: `重複候補の再計算に失敗: recordId=${created.id}`,
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
  });
  revalidatePath("/slp/companies");
  return { id: created.id };
}

/**
 * 企業名簿レコードの「概要案内」「導入希望商談」関連を部分更新する。
 * undefined のフィールドは更新せずスキップする（既存値を保持）。
 * null を明示的に渡したフィールドはクリアされる。
 */
export async function updateCompanyRecord(
  id: number,
  patch: {
    briefingStatus?: string | null;
    briefingBookedAt?: string | null;
    briefingDate?: string | null;
    briefingStaffId?: number | null;
    consultationStatus?: string | null;
    consultationBookedAt?: string | null;
    consultationDate?: string | null;
    consultationStaffId?: number | null;
  }
) {
  const data: {
    briefingStatus?: string | null;
    briefingBookedAt?: Date | null;
    briefingDate?: Date | null;
    briefingStaffId?: number | null;
    consultationStatus?: string | null;
    consultationBookedAt?: Date | null;
    consultationDate?: Date | null;
    consultationStaffId?: number | null;
  } = {};

  if (patch.briefingStatus !== undefined) {
    data.briefingStatus = patch.briefingStatus || null;
  }
  if (patch.briefingBookedAt !== undefined) {
    data.briefingBookedAt = patch.briefingBookedAt ? new Date(patch.briefingBookedAt) : null;
  }
  if (patch.briefingDate !== undefined) {
    data.briefingDate = patch.briefingDate ? new Date(patch.briefingDate) : null;
  }
  if (patch.briefingStaffId !== undefined) {
    data.briefingStaffId = patch.briefingStaffId;
  }
  if (patch.consultationStatus !== undefined) {
    data.consultationStatus = patch.consultationStatus || null;
  }
  if (patch.consultationBookedAt !== undefined) {
    data.consultationBookedAt = patch.consultationBookedAt ? new Date(patch.consultationBookedAt) : null;
  }
  if (patch.consultationDate !== undefined) {
    data.consultationDate = patch.consultationDate ? new Date(patch.consultationDate) : null;
  }
  if (patch.consultationStaffId !== undefined) {
    data.consultationStaffId = patch.consultationStaffId;
  }

  await prisma.slpCompanyRecord.update({
    where: { id },
    data,
  });
  revalidatePath("/slp/companies");
}

// ========================================
// 企業名簿 基本情報更新（Phase 1 で追加）
// ========================================

/** 数値文字列を Decimal用の文字列 or null に変換 */
function toDecimalOrNull(v: string | null | undefined): string | null {
  if (v === undefined) return null;
  if (v === null || v === "") return null;
  const trimmed = String(v).trim();
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (isNaN(num)) return null;
  return trimmed;
}

/** 数値文字列を Int or null に変換 */
function toIntOrNull(v: string | number | null | undefined): number | null {
  if (v === undefined || v === null || v === "") return null;
  const num = typeof v === "number" ? v : parseInt(String(v), 10);
  return isNaN(num) ? null : num;
}

/** 日付文字列を Date or null に変換 */
function toDateOrNull(v: string | null | undefined): Date | null {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export type CompanyBasicInfoPatch = {
  // 基本情報
  companyName?: string | null;
  representativeName?: string | null;
  employeeCount?: string | null;
  prefecture?: string | null;
  address?: string | null;
  companyPhone?: string | null;
  pensionOffice?: string | null;
  pensionOfficerName?: string | null;
  industryId?: number | null;
  flowSourceId?: number | null;
  salesStaffId?: number | null;
  status1Id?: number | null;
  status2Id?: number | null;
  lastContactDate?: string | null;
  annualLaborCostExecutive?: string | null;
  annualLaborCostEmployee?: string | null;
  averageMonthlySalary?: string | null;
  // 事業形態・法人/個人事業主対応
  businessType?: string | null;
  corporateNumber?: string | null;
  companyEmail?: string | null;
  representativePhone?: string | null;
  representativeEmail?: string | null;
  primaryContactId?: number | null;
  // 金額・契約情報
  initialFee?: string | null;
  initialPeopleCount?: string | null;
  monthlyFee?: string | null;
  monthlyPeopleCount?: string | null;
  contractDate?: string | null;
  lastPaymentDate?: string | null;
  invoiceSentDate?: string | null;
  nextPaymentDate?: string | null;
  estMaxRefundPeople?: string | null;
  estMaxRefundAmount?: string | null;
  estOurRevenue?: string | null;
  estAgentPayment?: string | null;
  confirmedRefundPeople?: string | null;
  confirmedRefundAmount?: string | null;
  confirmedOurRevenue?: string | null;
  confirmedAgentPayment?: string | null;
  paymentReceivedDate?: string | null;
};

/**
 * 企業名簿レコードの「基本情報」「金額・契約情報」をまとめて更新する。
 * undefined のフィールドは更新せずスキップする。
 */
export async function updateCompanyBasicInfo(
  id: number,
  patch: CompanyBasicInfoPatch
) {
  const data: Record<string, unknown> = {};

  // 文字列フィールド
  const stringFields: (keyof CompanyBasicInfoPatch)[] = [
    "companyName",
    "representativeName",
    "prefecture",
    "address",
    "companyPhone",
    "pensionOffice",
    "pensionOfficerName",
    "corporateNumber",
    "companyEmail",
    "representativePhone",
    "representativeEmail",
    "businessType",
  ];
  for (const f of stringFields) {
    if (patch[f] !== undefined) {
      const v = patch[f] as string | null;
      data[f] = v && v.trim() !== "" ? v.trim() : null;
    }
  }

  // 整数フィールド
  if (patch.employeeCount !== undefined) data.employeeCount = toIntOrNull(patch.employeeCount);
  if (patch.initialPeopleCount !== undefined) data.initialPeopleCount = toIntOrNull(patch.initialPeopleCount);
  if (patch.monthlyPeopleCount !== undefined) data.monthlyPeopleCount = toIntOrNull(patch.monthlyPeopleCount);
  if (patch.estMaxRefundPeople !== undefined) data.estMaxRefundPeople = toIntOrNull(patch.estMaxRefundPeople);
  if (patch.confirmedRefundPeople !== undefined) data.confirmedRefundPeople = toIntOrNull(patch.confirmedRefundPeople);

  // Decimal金額フィールド
  if (patch.annualLaborCostExecutive !== undefined) data.annualLaborCostExecutive = toDecimalOrNull(patch.annualLaborCostExecutive);
  if (patch.annualLaborCostEmployee !== undefined) data.annualLaborCostEmployee = toDecimalOrNull(patch.annualLaborCostEmployee);
  if (patch.averageMonthlySalary !== undefined) data.averageMonthlySalary = toDecimalOrNull(patch.averageMonthlySalary);
  if (patch.initialFee !== undefined) data.initialFee = toDecimalOrNull(patch.initialFee);
  if (patch.monthlyFee !== undefined) data.monthlyFee = toDecimalOrNull(patch.monthlyFee);
  if (patch.estMaxRefundAmount !== undefined) data.estMaxRefundAmount = toDecimalOrNull(patch.estMaxRefundAmount);
  if (patch.estOurRevenue !== undefined) data.estOurRevenue = toDecimalOrNull(patch.estOurRevenue);
  if (patch.estAgentPayment !== undefined) data.estAgentPayment = toDecimalOrNull(patch.estAgentPayment);
  if (patch.confirmedRefundAmount !== undefined) data.confirmedRefundAmount = toDecimalOrNull(patch.confirmedRefundAmount);
  if (patch.confirmedOurRevenue !== undefined) data.confirmedOurRevenue = toDecimalOrNull(patch.confirmedOurRevenue);
  if (patch.confirmedAgentPayment !== undefined) data.confirmedAgentPayment = toDecimalOrNull(patch.confirmedAgentPayment);

  // 日付フィールド
  if (patch.lastContactDate !== undefined) data.lastContactDate = toDateOrNull(patch.lastContactDate);
  if (patch.contractDate !== undefined) data.contractDate = toDateOrNull(patch.contractDate);
  if (patch.lastPaymentDate !== undefined) data.lastPaymentDate = toDateOrNull(patch.lastPaymentDate);
  if (patch.invoiceSentDate !== undefined) data.invoiceSentDate = toDateOrNull(patch.invoiceSentDate);
  if (patch.nextPaymentDate !== undefined) data.nextPaymentDate = toDateOrNull(patch.nextPaymentDate);
  if (patch.paymentReceivedDate !== undefined) data.paymentReceivedDate = toDateOrNull(patch.paymentReceivedDate);

  // FK（ID系）
  if (patch.industryId !== undefined) {
    data.industryId = patch.industryId !== null ? patch.industryId : null;
  }
  if (patch.flowSourceId !== undefined) {
    data.flowSourceId = patch.flowSourceId !== null ? patch.flowSourceId : null;
  }
  if (patch.salesStaffId !== undefined) {
    data.salesStaffId = patch.salesStaffId !== null ? patch.salesStaffId : null;
  }
  if (patch.status1Id !== undefined) {
    data.status1Id = patch.status1Id !== null ? patch.status1Id : null;
  }
  if (patch.status2Id !== undefined) {
    data.status2Id = patch.status2Id !== null ? patch.status2Id : null;
  }
  if (patch.primaryContactId !== undefined) {
    data.primaryContactId = patch.primaryContactId !== null ? patch.primaryContactId : null;
  }

  await prisma.slpCompanyRecord.update({
    where: { id },
    data,
  });

  // 企業名・電話番号・住所のいずれかが更新された場合は重複候補を再計算
  const duplicateRelevantChanged =
    patch.companyName !== undefined ||
    patch.companyPhone !== undefined ||
    patch.address !== undefined ||
    patch.prefecture !== undefined ||
    patch.corporateNumber !== undefined;
  if (duplicateRelevantChanged) {
    recomputeDuplicateCandidatesForRecord(id).catch(async (err) => {
      await logAutomationError({
        source: "slp-recompute-duplicates",
        message: `重複候補の再計算に失敗: recordId=${id}`,
        detail: { error: err instanceof Error ? err.message : String(err) },
      });
    });
  }

  // 代表者→担当者 双方向同期: primaryContactId が設定されていて代表者情報が変更された場合、
  // 担当者レコードの name/phone/email も同時更新し、isPrimary を設定する
  if (data.primaryContactId && typeof data.primaryContactId === "number") {
    const contactSyncData: Record<string, unknown> = {};
    if (patch.representativeName !== undefined) {
      const v = patch.representativeName?.trim();
      contactSyncData.name = v || null;
    }
    if (patch.representativePhone !== undefined) {
      const v = patch.representativePhone?.trim();
      contactSyncData.phone = v || null;
    }
    if (patch.representativeEmail !== undefined) {
      const v = patch.representativeEmail?.trim();
      contactSyncData.email = v || null;
    }
    // 担当者レコードに同期 + isPrimary 更新
    await prisma.$transaction([
      // まず全担当者の isPrimary を false にリセット
      prisma.slpCompanyContact.updateMany({
        where: { companyRecordId: id },
        data: { isPrimary: false },
      }),
      // 選択された担当者を isPrimary = true + 代表者情報を同期
      prisma.slpCompanyContact.update({
        where: { id: data.primaryContactId as number },
        data: {
          isPrimary: true,
          ...contactSyncData,
        },
      }),
    ]);
  }

  revalidatePath("/slp/companies");
}

// ========================================
// マスタ管理（業種・流入経路・ステータス①・ステータス②）
// 画面から「その場で新規追加」できるように
// ========================================

export type MasterKind = "industry" | "flow_source" | "status1" | "status2";

export type MasterItem = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

const MASTER_LABELS: Record<MasterKind, string> = {
  industry: "業種",
  flow_source: "流入経路",
  status1: "ステータス①",
  status2: "ステータス②",
};

/** マスタ全件取得（無効含む。管理モーダル用） */
export async function getAllMasterOptions(kind: MasterKind): Promise<MasterItem[]> {
  switch (kind) {
    case "industry":
      return prisma.slpIndustryMaster.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });
    case "flow_source":
      return prisma.slpFlowSourceMaster.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });
    case "status1":
      return prisma.slpCompanyStatus1Master.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });
    case "status2":
      return prisma.slpCompanyStatus2Master.findMany({
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      });
  }
}

/** マスタの新規追加（管理モーダルから呼ばれる） */
export async function addMasterOption(
  kind: MasterKind,
  name: string,
  isActive: boolean = true
): Promise<ActionResult<MasterItem>> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      return err("名称を入力してください");
    }

    // 重複チェック
    const label = MASTER_LABELS[kind];
    let existsId: number | null = null;
    switch (kind) {
      case "industry": {
        const e = await prisma.slpIndustryMaster.findUnique({ where: { name: trimmed }, select: { id: true } });
        existsId = e?.id ?? null;
        break;
      }
      case "flow_source": {
        const e = await prisma.slpFlowSourceMaster.findUnique({ where: { name: trimmed }, select: { id: true } });
        existsId = e?.id ?? null;
        break;
      }
      case "status1": {
        const e = await prisma.slpCompanyStatus1Master.findUnique({ where: { name: trimmed }, select: { id: true } });
        existsId = e?.id ?? null;
        break;
      }
      case "status2": {
        const e = await prisma.slpCompanyStatus2Master.findUnique({ where: { name: trimmed }, select: { id: true } });
        existsId = e?.id ?? null;
        break;
      }
    }
    if (existsId !== null) {
      return err(`同じ${label}名「${trimmed}」が既に登録されています`);
    }

    // displayOrder = 既存最大値 + 1
    let result: MasterItem;
    switch (kind) {
      case "industry": {
        const max = await prisma.slpIndustryMaster.aggregate({ _max: { displayOrder: true } });
        const displayOrder = (max._max.displayOrder ?? 0) + 1;
        result = await prisma.slpIndustryMaster.create({
          data: { name: trimmed, displayOrder, isActive },
        });
        break;
      }
      case "flow_source": {
        const max = await prisma.slpFlowSourceMaster.aggregate({ _max: { displayOrder: true } });
        const displayOrder = (max._max.displayOrder ?? 0) + 1;
        result = await prisma.slpFlowSourceMaster.create({
          data: { name: trimmed, displayOrder, isActive },
        });
        break;
      }
      case "status1": {
        const max = await prisma.slpCompanyStatus1Master.aggregate({ _max: { displayOrder: true } });
        const displayOrder = (max._max.displayOrder ?? 0) + 1;
        result = await prisma.slpCompanyStatus1Master.create({
          data: { name: trimmed, displayOrder, isActive },
        });
        break;
      }
      case "status2": {
        const max = await prisma.slpCompanyStatus2Master.aggregate({ _max: { displayOrder: true } });
        const displayOrder = (max._max.displayOrder ?? 0) + 1;
        result = await prisma.slpCompanyStatus2Master.create({
          data: { name: trimmed, displayOrder, isActive },
        });
        break;
      }
    }

    revalidatePath("/slp/companies");
    return ok(result);
  } catch (e) {
    console.error("[addMasterOption] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** マスタ更新（名称・有効フラグ） */
export async function updateMasterOption(
  kind: MasterKind,
  id: number,
  patch: { name?: string; isActive?: boolean }
): Promise<ActionResult> {
  try {
    const data: { name?: string; isActive?: boolean } = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return err("名称を入力してください");
      data.name = trimmed;
    }
    if (patch.isActive !== undefined) {
      data.isActive = patch.isActive;
    }
    if (Object.keys(data).length === 0) return ok();

    switch (kind) {
      case "industry":
        await prisma.slpIndustryMaster.update({ where: { id }, data });
        break;
      case "flow_source":
        await prisma.slpFlowSourceMaster.update({ where: { id }, data });
        break;
      case "status1":
        await prisma.slpCompanyStatus1Master.update({ where: { id }, data });
        break;
      case "status2":
        await prisma.slpCompanyStatus2Master.update({ where: { id }, data });
        break;
    }
    revalidatePath("/slp/companies");
    return ok();
  } catch (e) {
    console.error("[updateMasterOption] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** マスタ削除（使用中の場合はエラー） */
export async function deleteMasterOption(kind: MasterKind, id: number): Promise<ActionResult> {
  try {
    const label = MASTER_LABELS[kind];
    let usageCount: number;

    switch (kind) {
      case "industry":
        usageCount = await prisma.slpCompanyRecord.count({
          where: { industryId: id, deletedAt: null },
        });
        break;
      case "flow_source":
        usageCount = await prisma.slpCompanyRecord.count({
          where: { flowSourceId: id, deletedAt: null },
        });
        break;
      case "status1":
        usageCount = await prisma.slpCompanyRecord.count({
          where: { status1Id: id, deletedAt: null },
        });
        break;
      case "status2":
        usageCount = await prisma.slpCompanyRecord.count({
          where: { status2Id: id, deletedAt: null },
        });
        break;
    }

    if (usageCount > 0) {
      return err(`この${label}は${usageCount}件の事業者名簿で使用中のため削除できません`);
    }

    switch (kind) {
      case "industry":
        await prisma.slpIndustryMaster.delete({ where: { id } });
        break;
      case "flow_source":
        await prisma.slpFlowSourceMaster.delete({ where: { id } });
        break;
      case "status1":
        await prisma.slpCompanyStatus1Master.delete({ where: { id } });
        break;
      case "status2":
        await prisma.slpCompanyStatus2Master.delete({ where: { id } });
        break;
    }
    revalidatePath("/slp/companies");
    return ok();
  } catch (e) {
    console.error("[deleteMasterOption] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** マスタの並び替え */
export async function reorderMasterOptions(
  kind: MasterKind,
  orderedIds: number[]
): Promise<void> {
  switch (kind) {
    case "industry":
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.slpIndustryMaster.update({ where: { id }, data: { displayOrder: index + 1 } })
        )
      );
      break;
    case "flow_source":
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.slpFlowSourceMaster.update({ where: { id }, data: { displayOrder: index + 1 } })
        )
      );
      break;
    case "status1":
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.slpCompanyStatus1Master.update({ where: { id }, data: { displayOrder: index + 1 } })
        )
      );
      break;
    case "status2":
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.slpCompanyStatus2Master.update({ where: { id }, data: { displayOrder: index + 1 } })
        )
      );
      break;
  }
  revalidatePath("/slp/companies");
}

export async function deleteCompanyRecord(id: number) {
  await prisma.slpCompanyRecord.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/slp/companies");
}

// ========================================
// 担当者 CRUD
// ========================================

export async function addContact(data: {
  companyRecordId: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  lineFriendId: number | null;
}): Promise<{ tagResults: TagResult[] }> {
  // 既存担当者がなければ isPrimary=true
  const existingCount = await prisma.slpCompanyContact.count({
    where: { companyRecordId: data.companyRecordId },
  });

  const created = await prisma.slpCompanyContact.create({
    data: {
      companyRecordId: data.companyRecordId,
      name: data.name || null,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      lineFriendId: data.lineFriendId,
      isPrimary: existingCount === 0,
    },
  });

  // 親企業のステータスが「完了」かつ LINE紐付けがあればタグ付与
  // 概要案内・導入希望商談 それぞれ独立に判定する
  const tagResults: TagResult[] = [];
  if (data.lineFriendId !== null) {
    const record = await prisma.slpCompanyRecord.findUnique({
      where: { id: data.companyRecordId },
      select: { briefingStatus: true, consultationStatus: true },
    });
    if (record?.briefingStatus === "完了") {
      const r = await applyTagToContact(created.id, "add", "briefing-complete");
      if (r) tagResults.push(r);
    }
    if (record?.consultationStatus === "完了") {
      const r = await applyTagToContact(created.id, "add", "consultation-complete");
      if (r) tagResults.push(r);
    }
  }

  revalidatePath("/slp/companies");
  return { tagResults };
}

export async function updateContact(
  id: number,
  data: {
    name: string;
    role: string;
    email: string;
    phone: string;
    lineFriendId: number | null;
  }
): Promise<{ tagResults: TagResult[] }> {
  // 変更前の状態を取得
  const before = await prisma.slpCompanyContact.findUnique({
    where: { id },
    include: {
      lineFriend: { select: { uid: true } },
      companyRecord: { select: { briefingStatus: true, consultationStatus: true } },
    },
  });

  await prisma.slpCompanyContact.update({
    where: { id },
    data: {
      name: data.name || null,
      role: data.role || null,
      email: data.email || null,
      phone: data.phone || null,
      lineFriendId: data.lineFriendId,
    },
  });

  // 逆方向同期: この担当者が代表者として選択されている場合、
  // 企業の代表者情報も同時に更新する
  const companyWithPrimary = await prisma.slpCompanyRecord.findFirst({
    where: { primaryContactId: id, deletedAt: null },
  });
  if (companyWithPrimary) {
    await prisma.slpCompanyRecord.update({
      where: { id: companyWithPrimary.id },
      data: {
        representativeName: data.name || null,
        representativePhone: data.phone || null,
        representativeEmail: data.email || null,
      },
    });
  }

  // タグ連動: 親企業が「完了」状態かつ lineFriendId が変わった場合
  // 概要案内・導入希望商談 それぞれ独立にタグ操作する
  const tagResults: TagResult[] = [];
  const oldUid = before?.lineFriend?.uid ?? null;
  const oldLineFriendId = before?.lineFriendId ?? null;
  const lineFriendChanged = oldLineFriendId !== data.lineFriendId;

  // 旧LINE友達からタグを削除（紐付けがあったが変更された場合）
  if (oldUid && lineFriendChanged) {
    if (before?.companyRecord.briefingStatus === "完了") {
      try {
        await removeBriefingCompleteTag(oldUid);
      } catch (e) {
        await logAutomationError({
          source: "slp-tag-briefing-complete-remove",
          message: `旧担当者の概要案内完了タグ削除失敗: contactId=${id}, uid=${oldUid}`,
          detail: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
    if (before?.companyRecord.consultationStatus === "完了") {
      try {
        await removeConsultationCompleteTag(oldUid);
      } catch (e) {
        await logAutomationError({
          source: "slp-tag-consultation-complete-remove",
          message: `旧担当者の導入希望商談完了タグ削除失敗: contactId=${id}, uid=${oldUid}`,
          detail: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
  }

  // 新LINE友達にタグ付与（新規紐付け or 別LINEへ変更）
  if (data.lineFriendId !== null && lineFriendChanged) {
    if (before?.companyRecord.briefingStatus === "完了") {
      const r = await applyTagToContact(id, "add", "briefing-complete");
      if (r) tagResults.push(r);
    }
    if (before?.companyRecord.consultationStatus === "完了") {
      const r = await applyTagToContact(id, "add", "consultation-complete");
      if (r) tagResults.push(r);
    }
  }

  revalidatePath("/slp/companies");
  return { tagResults };
}

export async function deleteContact(id: number): Promise<{ tagResults: TagResult[] }> {
  // 削除前の情報を取得
  const contact = await prisma.slpCompanyContact.findUnique({
    where: { id },
    include: {
      lineFriend: { select: { uid: true, snsname: true } },
      companyRecord: { select: { briefingStatus: true, consultationStatus: true } },
    },
  });

  // 完了状態の企業から LINE紐付け済の担当者を削除する場合はタグ削除
  // 概要案内・導入希望商談 それぞれ独立にタグ操作する
  const tagResults: TagResult[] = [];
  if (contact?.lineFriend?.uid) {
    const uid = contact.lineFriend.uid;
    const displayName = contact.name ?? contact.lineFriend.snsname ?? "(名前なし)";

    if (contact.companyRecord.briefingStatus === "完了") {
      try {
        await removeBriefingCompleteTag(uid);
        tagResults.push({ contactId: id, name: displayName, uid, success: true });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        tagResults.push({ contactId: id, name: displayName, uid, success: false, error: errMsg });
        await logAutomationError({
          source: "slp-tag-briefing-complete-remove",
          message: `削除担当者の概要案内完了タグ削除失敗: contactId=${id}, uid=${uid}`,
          detail: { error: errMsg },
        });
      }
    }

    if (contact.companyRecord.consultationStatus === "完了") {
      try {
        await removeConsultationCompleteTag(uid);
        tagResults.push({ contactId: id, name: displayName, uid, success: true });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        tagResults.push({ contactId: id, name: displayName, uid, success: false, error: errMsg });
        await logAutomationError({
          source: "slp-tag-consultation-complete-remove",
          message: `削除担当者の導入希望商談完了タグ削除失敗: contactId=${id}, uid=${uid}`,
          detail: { error: errMsg },
        });
      }
    }
  }

  await prisma.slpCompanyContact.delete({ where: { id } });

  // 主担当が削除された場合、別の担当者を昇格
  if (contact?.isPrimary) {
    const next = await prisma.slpCompanyContact.findFirst({
      where: { companyRecordId: contact.companyRecordId },
      orderBy: { id: "asc" },
    });
    if (next) {
      await prisma.slpCompanyContact.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }
  revalidatePath("/slp/companies");
  return { tagResults };
}

export async function setPrimaryContact(id: number, companyRecordId: number) {
  await prisma.$transaction([
    prisma.slpCompanyContact.updateMany({
      where: { companyRecordId },
      data: { isPrimary: false },
    }),
    prisma.slpCompanyContact.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ]);
  revalidatePath("/slp/companies");
}

// ========================================
// ステータス変更（理由付き）
// ========================================

export type FlowKind = "briefing" | "consultation";

/**
 * 概要案内/導入希望商談 共通: ステータスを変更し、変更履歴を記録する。
 * 「予約中 → 完了」以外の変更時は理由が必須。
 *
 * タグ連動:
 *   - fromStatus !== "完了" && toStatus === "完了" → 全担当者にタグ付与
 *   - fromStatus === "完了" && toStatus !== "完了" → 全担当者からタグ削除
 */
async function _changeStatusWithReasonImpl(
  recordId: number,
  toStatus: string,
  reason: string,
  flow: FlowKind
): Promise<{ tagResults: TagResult[] }> {
  if (!reason.trim()) {
    throw new Error("変更理由は必須です");
  }

  const current = await prisma.slpCompanyRecord.findUnique({
    where: { id: recordId },
    select: { briefingStatus: true, consultationStatus: true },
  });
  const fromStatus =
    flow === "briefing" ? current?.briefingStatus ?? null : current?.consultationStatus ?? null;

  const staffId = await getCurrentStaffId();

  // ステータス変更に伴い canceledAt も整合させる:
  // - 「キャンセル」に変更 → canceledAt をセット
  // - 「キャンセル」以外に変更 → canceledAt をクリア（過去のキャンセル記録を解消）
  // これにより resolver.ts の `status === "予約中" && canceledAt === null` 判定が正しく動作する
  const canceledAtValue = toStatus === "キャンセル" ? new Date() : null;
  const updateData =
    flow === "briefing"
      ? { briefingStatus: toStatus, briefingCanceledAt: canceledAtValue }
      : { consultationStatus: toStatus, consultationCanceledAt: canceledAtValue };

  await prisma.$transaction([
    prisma.slpCompanyRecord.update({
      where: { id: recordId },
      data: updateData,
    }),
    prisma.slpCompanyRecordStatusHistory.create({
      data: {
        recordId,
        flow,
        fromStatus,
        toStatus,
        reason: reason.trim(),
        changedById: staffId,
      },
    }),
  ]);

  // タグ連動
  const tagType: TagType = flow === "briefing" ? "briefing-complete" : "consultation-complete";
  let tagResults: TagResult[] = [];
  if (fromStatus !== "完了" && toStatus === "完了") {
    tagResults = await applyTagToAllContacts(recordId, "add", tagType);
  } else if (fromStatus === "完了" && toStatus !== "完了") {
    tagResults = await applyTagToAllContacts(recordId, "remove", tagType);
  }

  revalidatePath("/slp/companies");
  return { tagResults };
}

/** 概要案内のステータス変更（理由付き） */
export async function changeBriefingStatusWithReason(
  recordId: number,
  toStatus: string,
  reason: string
): Promise<ActionResult<{ tagResults: TagResult[] }>> {
  try {
    const result = await _changeStatusWithReasonImpl(recordId, toStatus, reason, "briefing");
    return ok(result);
  } catch (e) {
    console.error("[changeBriefingStatusWithReason] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 導入希望商談のステータス変更（理由付き） */
export async function changeConsultationStatusWithReason(
  recordId: number,
  toStatus: string,
  reason: string
): Promise<ActionResult<{ tagResults: TagResult[] }>> {
  try {
    const result = await _changeStatusWithReasonImpl(recordId, toStatus, reason, "consultation");
    return ok(result);
  } catch (e) {
    console.error("[changeConsultationStatusWithReason] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** @deprecated changeBriefingStatusWithReason を使用してください */
export async function changeStatusWithReason(
  recordId: number,
  toStatus: string,
  reason: string
): Promise<ActionResult<{ tagResults: TagResult[] }>> {
  return changeBriefingStatusWithReason(recordId, toStatus, reason);
}

// ========================================
// 概要案内完了処理（form11 + form10送信）
// ========================================

export type CompletionResult = {
  attendeeResults: {
    contactId: number;
    name: string;
    success: boolean;
    error?: string;
  }[];
  referrerResults: {
    referrerUid: string;
    snsname: string;
    success: boolean;
    error?: string;
  }[];
  tagResults: TagResult[];
};

/**
 * 企業名簿レコードのステータスを「完了」に更新し、
 * 選択された担当者にお礼メッセージ(form11)を送信、
 * その担当者の紹介者に完了通知(form10)を送信する。
 *
 * 同じ紹介者(free1)を持つ担当者が複数いる場合、
 * 紹介者には1通だけ送信し、snsnameはカンマ区切りで結合する。
 */
export async function completeBriefingAndNotify(
  recordId: number,
  selectedContactIds: number[],
  thankYouMessage: string,
  reason: string | null = null
): Promise<CompletionResult> {
  // 1. ステータスを「完了」に更新 + 履歴記録
  const current = await prisma.slpCompanyRecord.findUnique({
    where: { id: recordId },
    select: { briefingStatus: true },
  });
  const staffId = await getCurrentStaffId();

  await prisma.$transaction([
    prisma.slpCompanyRecord.update({
      where: { id: recordId },
      // status を「完了」に進める際、過去にキャンセルされた記録があれば
      // canceledAt もクリアしてデータ整合性を保つ
      // （resolver.ts の判定や将来の再予約フローでの不整合を防ぐため）
      data: { briefingStatus: "完了", briefingCanceledAt: null },
    }),
    prisma.slpCompanyRecordStatusHistory.create({
      data: {
        recordId,
        flow: "briefing",
        fromStatus: current?.briefingStatus ?? null,
        toStatus: "完了",
        reason: reason && reason.trim() ? reason.trim() : null,
        changedById: staffId,
      },
    }),
  ]);

  const result: CompletionResult = {
    attendeeResults: [],
    referrerResults: [],
    tagResults: [],
  };

  // 全担当者にタグ付与（fromStatusが「完了」でない場合のみ実行）
  if (current?.briefingStatus !== "完了") {
    result.tagResults = await applyTagToAllContacts(recordId, "add", "briefing-complete");
  }

  // 担当者が選択されていない場合はステータス更新のみ（タグは付与済み）
  if (selectedContactIds.length === 0) {
    revalidatePath("/slp/companies");
    return result;
  }

  // 2. 選択された担当者の情報を取得（lineFriend経由でuid/snsname/free1）
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { id: { in: selectedContactIds } },
    include: {
      lineFriend: { select: { uid: true, snsname: true, free1: true } },
    },
  });

  // 3. 各担当者にform11（お礼メッセージ）を同期送信
  for (const contact of contacts) {
    const displayName = contact.name ?? contact.lineFriend?.snsname ?? "(名前なし)";
    const uid = contact.lineFriend?.uid;
    if (!uid) {
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: false,
        error: "公式LINE未紐付け",
      });
      continue;
    }
    try {
      await submitForm11BriefingThankYou(uid, thankYouMessage);
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: true,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: false,
        error: errMsg,
      });
      await logAutomationError({
        source: "slp-briefing-complete-form11",
        message: `概要案内完了お礼メッセージ送信失敗: ${displayName} (uid=${uid})`,
        detail: {
          error: errMsg,
          uid,
          contactId: contact.id,
          name: displayName,
          freeText: thankYouMessage,
          retryAction: "form11-briefing-thank-you",
        },
      });
    }
  }

  // 4. 紹介者ごとにグループ化（free1単位で重複排除、snsnameをカンマ区切り）
  const referrerGroups = new Map<string, string[]>(); // free1 → [snsname, ...]
  for (const contact of contacts) {
    const referrerUid = contact.lineFriend?.free1?.trim();
    const snsname = contact.lineFriend?.snsname;
    if (!referrerUid || !snsname) continue;
    const list = referrerGroups.get(referrerUid) ?? [];
    list.push(snsname);
    referrerGroups.set(referrerUid, list);
  }

  // 5. 各紹介者にform10（完了通知）を同期送信
  for (const [referrerUid, snsnames] of referrerGroups) {
    const combinedName = snsnames.join(", ");
    try {
      await submitForm10BriefingComplete(referrerUid, combinedName);
      result.referrerResults.push({
        referrerUid,
        snsname: combinedName,
        success: true,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      result.referrerResults.push({
        referrerUid,
        snsname: combinedName,
        success: false,
        error: errMsg,
      });
      await logAutomationError({
        source: "slp-briefing-complete-form10",
        message: `紹介者完了通知送信失敗: referrerUid=${referrerUid}, snsname=${combinedName}`,
        detail: {
          error: errMsg,
          referrerUid,
          snsname: combinedName,
          retryAction: "form10-briefing-complete",
        },
      });
    }
  }

  revalidatePath("/slp/companies");
  return result;
}

// ========================================
// 導入希望商談 完了処理（form13送信 + タグ付与、紹介者通知なし）
// ========================================

export type ConsultationCompletionResult = {
  attendeeResults: {
    contactId: number;
    name: string;
    success: boolean;
    error?: string;
  }[];
  tagResults: TagResult[];
};

/**
 * 企業名簿レコードの導入希望商談ステータスを「完了」に更新し、
 * 選択された担当者にお礼メッセージ(form13)を送信し、
 * 全担当者に導入希望商談完了タグを付与する。
 *
 * 紹介者通知（form10相当）は送信しない。
 */
export async function completeConsultationAndNotify(
  recordId: number,
  selectedContactIds: number[],
  thankYouMessage: string,
  reason: string | null = null
): Promise<ConsultationCompletionResult> {
  // 1. ステータスを「完了」に更新 + 履歴記録
  const current = await prisma.slpCompanyRecord.findUnique({
    where: { id: recordId },
    select: { consultationStatus: true },
  });
  const staffId = await getCurrentStaffId();

  await prisma.$transaction([
    prisma.slpCompanyRecord.update({
      where: { id: recordId },
      // status を「完了」に進める際、過去にキャンセルされた記録があれば
      // canceledAt もクリアしてデータ整合性を保つ
      data: { consultationStatus: "完了", consultationCanceledAt: null },
    }),
    prisma.slpCompanyRecordStatusHistory.create({
      data: {
        recordId,
        flow: "consultation",
        fromStatus: current?.consultationStatus ?? null,
        toStatus: "完了",
        reason: reason && reason.trim() ? reason.trim() : null,
        changedById: staffId,
      },
    }),
  ]);

  const result: ConsultationCompletionResult = {
    attendeeResults: [],
    tagResults: [],
  };

  // 全担当者にタグ付与（fromStatusが「完了」でない場合のみ実行）
  if (current?.consultationStatus !== "完了") {
    result.tagResults = await applyTagToAllContacts(recordId, "add", "consultation-complete");
  }

  // 担当者が選択されていない場合はステータス更新のみ（タグは付与済み）
  if (selectedContactIds.length === 0) {
    revalidatePath("/slp/companies");
    return result;
  }

  // 2. 選択された担当者の情報を取得
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { id: { in: selectedContactIds } },
    include: {
      lineFriend: { select: { uid: true, snsname: true } },
    },
  });

  // 3. 各担当者にform13（導入希望商談お礼メッセージ）を同期送信
  for (const contact of contacts) {
    const displayName = contact.name ?? contact.lineFriend?.snsname ?? "(名前なし)";
    const uid = contact.lineFriend?.uid;
    if (!uid) {
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: false,
        error: "公式LINE未紐付け",
      });
      continue;
    }
    try {
      await submitForm13ConsultationThankYou(uid, thankYouMessage);
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: true,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      result.attendeeResults.push({
        contactId: contact.id,
        name: displayName,
        success: false,
        error: errMsg,
      });
      await logAutomationError({
        source: "slp-consultation-complete-form13",
        message: `導入希望商談完了お礼メッセージ送信失敗: ${displayName} (uid=${uid})`,
        detail: {
          error: errMsg,
          uid,
          contactId: contact.id,
          name: displayName,
          freeText: thankYouMessage,
          retryAction: "form13-consultation-thank-you",
        },
      });
    }
  }

  revalidatePath("/slp/companies");
  return result;
}

// ========================================
// LINE友達リスト（担当者選択用）
// ========================================

export async function getLineFriendOptions() {
  const friends = await prisma.slpLineFriend.findMany({
    where: { deletedAt: null },
    select: { id: true, snsname: true, uid: true },
    orderBy: { id: "asc" },
  });
  return friends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname ?? ""}`.trim(),
    uid: f.uid,
  }));
}

// ========================================
// 提出書類（SlpCompanyDocument）
// 公開フォーム /form/slp-initial-documents, /form/slp-additional-documents
// から提出された書類の管理（論理削除）
// ========================================

/**
 * 提出書類の論理削除（スタッフのみ）
 * 削除されたレコードは画面・公開フォームの両方で非表示になる。
 * 物理ファイルは保持する（誤削除に備えて）。
 */
export async function softDeleteCompanyDocument(documentId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return err("認証が必要です");
    }
    await prisma.slpCompanyDocument.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/slp/companies");
    return ok();
  } catch (e) {
    console.error("[softDeleteCompanyDocument] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// AS担当の手動上書き（担当者ごと）
// ============================================

/**
 * 担当者のAS担当を手動で上書き保存する。
 * @param contactId 対象の SlpCompanyContact.id
 * @param manualAsId 設定するSlpAs.id（null で解除）
 * @param reason 変更理由（手動設定時は必須）
 */
export async function setManualContactAs(
  contactId: number,
  manualAsId: number | null,
  reason: string
): Promise<ActionResult> {
  try {
    const staffId = await getCurrentStaffId();
    if (staffId === null) return err("認証が必要です");

    if (manualAsId !== null && !reason.trim()) {
      return err("変更理由は必須です");
    }

    await prisma.slpCompanyContact.update({
      where: { id: contactId },
      data: {
        manualAsId,
        manualAsReason: manualAsId !== null ? reason.trim() : null,
        manualAsChangedAt: manualAsId !== null ? new Date() : null,
        manualAsChangedById: manualAsId !== null ? staffId : null,
      },
    });

    revalidatePath("/slp/companies");
    return ok();
  } catch (e) {
    console.error("[setManualContactAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 手動上書きを解除して自動解決値に戻す。
 */
export async function clearManualContactAs(contactId: number): Promise<ActionResult> {
  try {
    const staffId = await getCurrentStaffId();
    if (staffId === null) return err("認証が必要です");

    await prisma.slpCompanyContact.update({
      where: { id: contactId },
      data: {
        manualAsId: null,
        manualAsReason: null,
        manualAsChangedAt: null,
        manualAsChangedById: null,
      },
    });

    revalidatePath("/slp/companies");
    return ok();
  } catch (e) {
    console.error("[clearManualContactAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 重複統合機能
// ============================================

/**
 * 「この2社は重複ではない」とマーク
 * - SlpCompanyDuplicateExclusion に登録
 * - SlpCompanyDuplicateCandidate からそのペアを削除
 */
export async function markAsNotDuplicate(
  recordIdA: number,
  recordIdB: number,
  reason?: string
): Promise<ActionResult> {
  try {
    const staffId = await getCurrentStaffId();
    if (staffId === null) return err("認証が必要です");

    // 順序を統一（小さい方をAに）
    const a = Math.min(recordIdA, recordIdB);
    const b = Math.max(recordIdA, recordIdB);

    await prisma.slpCompanyDuplicateExclusion.upsert({
      where: { recordIdA_recordIdB: { recordIdA: a, recordIdB: b } },
      create: {
        recordIdA: a,
        recordIdB: b,
        excludedById: staffId,
        reason: reason?.trim() || null,
      },
      update: {
        excludedById: staffId,
        reason: reason?.trim() || null,
      },
    });

    // 候補テーブルから削除
    await prisma.slpCompanyDuplicateCandidate.deleteMany({
      where: { recordIdA: a, recordIdB: b },
    });

    revalidatePath("/slp/companies");
    revalidatePath(`/slp/companies/${a}`);
    revalidatePath(`/slp/companies/${b}`);
    return ok();
  } catch (e) {
    console.error("[markAsNotDuplicate] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 重複統合（マージ）を実行
 *
 * @param mainId 統合先（残す側）
 * @param mergedId 統合元（論理削除される側）
 * @param mergedData マージ画面でスタッフが編集した最終的なメインレコードの値
 */
export type MergeCompanyData = {
  companyName?: string | null;
  representativeName?: string | null;
  employeeCount?: string | null;
  prefecture?: string | null;
  address?: string | null;
  companyPhone?: string | null;
  pensionOffice?: string | null;
  pensionOfficerName?: string | null;
  industryId?: number | null;
  flowSourceId?: number | null;
  salesStaffId?: number | null;
  status1Id?: number | null;
  status2Id?: number | null;
  lastContactDate?: string | null;
  annualLaborCostExecutive?: string | null;
  annualLaborCostEmployee?: string | null;
  averageMonthlySalary?: string | null;
  initialFee?: string | null;
  initialPeopleCount?: string | null;
  monthlyFee?: string | null;
  monthlyPeopleCount?: string | null;
  contractDate?: string | null;
  lastPaymentDate?: string | null;
  invoiceSentDate?: string | null;
  nextPaymentDate?: string | null;
  estMaxRefundPeople?: string | null;
  estMaxRefundAmount?: string | null;
  estOurRevenue?: string | null;
  estAgentPayment?: string | null;
  confirmedRefundPeople?: string | null;
  confirmedRefundAmount?: string | null;
  confirmedOurRevenue?: string | null;
  confirmedAgentPayment?: string | null;
  paymentReceivedDate?: string | null;
};

export async function mergeCompanyRecords(
  mainId: number,
  mergedId: number,
  mergedData: MergeCompanyData
): Promise<ActionResult> {
  try {
  const staffId = await getCurrentStaffId();
  if (staffId === null) return err("認証が必要です");

  if (mainId === mergedId) {
    return err("同じレコード同士は統合できません");
  }

  // 両レコードを取得
  const [mainRecord, mergedRecord] = await Promise.all([
    prisma.slpCompanyRecord.findFirst({
      where: { id: mainId, deletedAt: null },
      include: {
        contacts: true,
        statusHistories: true,
        submittedDocuments: { where: { deletedAt: null } },
      },
    }),
    prisma.slpCompanyRecord.findFirst({
      where: { id: mergedId, deletedAt: null },
      include: {
        contacts: true,
        statusHistories: true,
        submittedDocuments: { where: { deletedAt: null } },
      },
    }),
  ]);

  if (!mainRecord) return err("統合先のレコードが見つかりません");
  if (!mergedRecord) return err("統合元のレコードが見つかりません");

  // マージする予約ID配列を構築
  const mergedBriefingIds = new Set<string>([
    ...mainRecord.mergedBriefingReservationIds,
    ...mergedRecord.mergedBriefingReservationIds,
  ]);
  const mergedConsultationIds = new Set<string>([
    ...mainRecord.mergedConsultationReservationIds,
    ...mergedRecord.mergedConsultationReservationIds,
  ]);

  // 編集された基本情報の data を構築（既存の updateCompanyBasicInfo パターンを流用）
  const updateData: Record<string, unknown> = {};

  // ============================================
  // 予約情報の自動マージ
  // ============================================
  // メインに概要案内予約が無く、マージ元にある場合 → マージ元の予約情報を取り込む
  // 両方にある場合 → メイン優先、マージ元の予約IDだけ配列に追加
  if (!mainRecord.reservationId && mergedRecord.reservationId) {
    // メインに予約なし → マージ元の予約をメインに昇格
    updateData.reservationId = mergedRecord.reservationId;
    updateData.briefingStatus = mergedRecord.briefingStatus;
    updateData.briefingBookedAt = mergedRecord.briefingBookedAt;
    updateData.briefingDate = mergedRecord.briefingDate;
    updateData.briefingStaff = mergedRecord.briefingStaff;
    updateData.briefingStaffId = mergedRecord.briefingStaffId;
    updateData.briefingChangedAt = mergedRecord.briefingChangedAt;
    updateData.briefingCanceledAt = mergedRecord.briefingCanceledAt;
  } else if (
    mergedRecord.reservationId &&
    mergedRecord.reservationId !== mainRecord.reservationId
  ) {
    // 両方に予約あり → マージ元の予約IDを配列に追加（メインは触らない）
    mergedBriefingIds.add(mergedRecord.reservationId);
  }

  // 同様に導入希望商談
  if (
    !mainRecord.consultationReservationId &&
    mergedRecord.consultationReservationId
  ) {
    updateData.consultationReservationId = mergedRecord.consultationReservationId;
    updateData.consultationStatus = mergedRecord.consultationStatus;
    updateData.consultationBookedAt = mergedRecord.consultationBookedAt;
    updateData.consultationDate = mergedRecord.consultationDate;
    updateData.consultationStaff = mergedRecord.consultationStaff;
    updateData.consultationStaffId = mergedRecord.consultationStaffId;
    updateData.consultationChangedAt = mergedRecord.consultationChangedAt;
    updateData.consultationCanceledAt = mergedRecord.consultationCanceledAt;
  } else if (
    mergedRecord.consultationReservationId &&
    mergedRecord.consultationReservationId !== mainRecord.consultationReservationId
  ) {
    mergedConsultationIds.add(mergedRecord.consultationReservationId);
  }

  // 文字列フィールド
  const stringFields: (keyof MergeCompanyData)[] = [
    "companyName",
    "representativeName",
    "prefecture",
    "address",
    "companyPhone",
    "pensionOffice",
    "pensionOfficerName",
  ];
  for (const f of stringFields) {
    if (mergedData[f] !== undefined) {
      const v = mergedData[f] as string | null;
      updateData[f] = v && v.trim() !== "" ? v.trim() : null;
    }
  }

  // 整数フィールド
  if (mergedData.employeeCount !== undefined)
    updateData.employeeCount = toIntOrNull(mergedData.employeeCount);
  if (mergedData.initialPeopleCount !== undefined)
    updateData.initialPeopleCount = toIntOrNull(mergedData.initialPeopleCount);
  if (mergedData.monthlyPeopleCount !== undefined)
    updateData.monthlyPeopleCount = toIntOrNull(mergedData.monthlyPeopleCount);
  if (mergedData.estMaxRefundPeople !== undefined)
    updateData.estMaxRefundPeople = toIntOrNull(mergedData.estMaxRefundPeople);
  if (mergedData.confirmedRefundPeople !== undefined)
    updateData.confirmedRefundPeople = toIntOrNull(
      mergedData.confirmedRefundPeople
    );

  // Decimal フィールド
  if (mergedData.annualLaborCostExecutive !== undefined)
    updateData.annualLaborCostExecutive = toDecimalOrNull(
      mergedData.annualLaborCostExecutive
    );
  if (mergedData.annualLaborCostEmployee !== undefined)
    updateData.annualLaborCostEmployee = toDecimalOrNull(
      mergedData.annualLaborCostEmployee
    );
  if (mergedData.averageMonthlySalary !== undefined)
    updateData.averageMonthlySalary = toDecimalOrNull(
      mergedData.averageMonthlySalary
    );
  if (mergedData.initialFee !== undefined)
    updateData.initialFee = toDecimalOrNull(mergedData.initialFee);
  if (mergedData.monthlyFee !== undefined)
    updateData.monthlyFee = toDecimalOrNull(mergedData.monthlyFee);
  if (mergedData.estMaxRefundAmount !== undefined)
    updateData.estMaxRefundAmount = toDecimalOrNull(
      mergedData.estMaxRefundAmount
    );
  if (mergedData.estOurRevenue !== undefined)
    updateData.estOurRevenue = toDecimalOrNull(mergedData.estOurRevenue);
  if (mergedData.estAgentPayment !== undefined)
    updateData.estAgentPayment = toDecimalOrNull(mergedData.estAgentPayment);
  if (mergedData.confirmedRefundAmount !== undefined)
    updateData.confirmedRefundAmount = toDecimalOrNull(
      mergedData.confirmedRefundAmount
    );
  if (mergedData.confirmedOurRevenue !== undefined)
    updateData.confirmedOurRevenue = toDecimalOrNull(
      mergedData.confirmedOurRevenue
    );
  if (mergedData.confirmedAgentPayment !== undefined)
    updateData.confirmedAgentPayment = toDecimalOrNull(
      mergedData.confirmedAgentPayment
    );

  // 日付フィールド
  if (mergedData.lastContactDate !== undefined)
    updateData.lastContactDate = toDateOrNull(mergedData.lastContactDate);
  if (mergedData.contractDate !== undefined)
    updateData.contractDate = toDateOrNull(mergedData.contractDate);
  if (mergedData.lastPaymentDate !== undefined)
    updateData.lastPaymentDate = toDateOrNull(mergedData.lastPaymentDate);
  if (mergedData.invoiceSentDate !== undefined)
    updateData.invoiceSentDate = toDateOrNull(mergedData.invoiceSentDate);
  if (mergedData.nextPaymentDate !== undefined)
    updateData.nextPaymentDate = toDateOrNull(mergedData.nextPaymentDate);
  if (mergedData.paymentReceivedDate !== undefined)
    updateData.paymentReceivedDate = toDateOrNull(
      mergedData.paymentReceivedDate
    );

  // FK
  if (mergedData.industryId !== undefined)
    updateData.industryId = mergedData.industryId;
  if (mergedData.flowSourceId !== undefined)
    updateData.flowSourceId = mergedData.flowSourceId;
  if (mergedData.salesStaffId !== undefined)
    updateData.salesStaffId = mergedData.salesStaffId;
  if (mergedData.status1Id !== undefined)
    updateData.status1Id = mergedData.status1Id;
  if (mergedData.status2Id !== undefined)
    updateData.status2Id = mergedData.status2Id;

  // 予約ID配列を更新
  updateData.mergedBriefingReservationIds = Array.from(mergedBriefingIds);
  updateData.mergedConsultationReservationIds = Array.from(mergedConsultationIds);

  // トランザクションで実行
  await prisma.$transaction(async (tx) => {
    // 1. メインレコードを更新
    await tx.slpCompanyRecord.update({
      where: { id: mainId },
      data: updateData,
    });

    // 2. 担当者をマージ先に移動（lineFriend重複は除外）
    // メインに既に同じ lineFriendId の担当者がいる場合、マージ元の担当者を削除
    // それ以外はマージ先に移動
    const mainLineFriendIds = new Set(
      mainRecord.contacts
        .map((c) => c.lineFriendId)
        .filter((id): id is number => id !== null)
    );
    const duplicateContactIds: number[] = [];
    const movableContactIds: number[] = [];
    for (const c of mergedRecord.contacts) {
      if (c.lineFriendId !== null && mainLineFriendIds.has(c.lineFriendId)) {
        // 同じ lineFriend が既に存在 → 削除
        duplicateContactIds.push(c.id);
      } else {
        // 移動可能
        movableContactIds.push(c.id);
      }
    }
    if (movableContactIds.length > 0) {
      await tx.slpCompanyContact.updateMany({
        where: { id: { in: movableContactIds } },
        data: { companyRecordId: mainId },
      });
    }
    if (duplicateContactIds.length > 0) {
      // 重複担当者は物理削除（マージ元が論理削除されると Cascade で消えるが念のため明示）
      await tx.slpCompanyContact.deleteMany({
        where: { id: { in: duplicateContactIds } },
      });
    }

    // 3. ステータス変更履歴をマージ先に移動
    await tx.slpCompanyRecordStatusHistory.updateMany({
      where: { recordId: mergedId },
      data: { recordId: mainId },
    });

    // 4. 提出書類をマージ先に移動
    await tx.slpCompanyDocument.updateMany({
      where: { companyRecordId: mergedId },
      data: { companyRecordId: mainId },
    });

    // 5. マージ元レコードを論理削除
    await tx.slpCompanyRecord.update({
      where: { id: mergedId },
      data: { deletedAt: new Date() },
    });

    // 6. 候補テーブルからこのペアを削除
    const a = Math.min(mainId, mergedId);
    const b = Math.max(mainId, mergedId);
    await tx.slpCompanyDuplicateCandidate.deleteMany({
      where: { recordIdA: a, recordIdB: b },
    });

    // 7. マージ元レコードに関する全候補を削除（論理削除済みなので不要）
    await tx.slpCompanyDuplicateCandidate.deleteMany({
      where: {
        OR: [{ recordIdA: mergedId }, { recordIdB: mergedId }],
      },
    });
  });

  // メインレコードについて重複候補を再計算（内容が変わったので）
  recomputeDuplicateCandidatesForRecord(mainId).catch(async (e) => {
    await logAutomationError({
      source: "slp-recompute-duplicates",
      message: `マージ後の重複候補再計算に失敗: recordId=${mainId}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });
  });

  revalidatePath("/slp/companies");
  revalidatePath(`/slp/companies/${mainId}`);
  return ok();
  } catch (e) {
    console.error("[mergeCompanyRecords] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 重複候補リストを取得（一覧表示用）
 */
export async function getDuplicateCandidates() {
  const candidates = await prisma.slpCompanyDuplicateCandidate.findMany({
    include: {
      recordA: {
        select: {
          id: true,
          companyName: true,
          companyPhone: true,
          prefecture: true,
          address: true,
          briefingStatus: true,
          briefingDate: true,
          createdAt: true,
        },
      },
      recordB: {
        select: {
          id: true,
          companyName: true,
          companyPhone: true,
          prefecture: true,
          address: true,
          briefingStatus: true,
          briefingDate: true,
          createdAt: true,
        },
      },
    },
    orderBy: { detectedAt: "desc" },
  });
  return candidates;
}
