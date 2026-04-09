"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  submitForm10BriefingComplete,
  submitForm11BriefingThankYou,
  addBriefingCompleteTag,
  removeBriefingCompleteTag,
} from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import { auth } from "@/auth";

/** タグ操作の結果型 */
export type TagResult = {
  contactId: number;
  name: string;
  uid: string;
  success: boolean;
  error?: string;
};

/**
 * 指定企業の全担当者（公式LINE紐付けあり）に対してタグ付与/削除を実行する。
 * 各担当者の結果を配列で返す。失敗時は automation_errors にも記録する。
 */
async function applyTagToAllContacts(
  recordId: number,
  action: "add" | "remove"
): Promise<TagResult[]> {
  const contacts = await prisma.slpCompanyContact.findMany({
    where: { companyRecordId: recordId },
    include: { lineFriend: { select: { uid: true, snsname: true } } },
  });

  const results: TagResult[] = [];
  for (const c of contacts) {
    const uid = c.lineFriend?.uid;
    if (!uid) continue; // LINE未紐付けはスキップ
    const displayName = c.name ?? c.lineFriend?.snsname ?? "(名前なし)";
    try {
      if (action === "add") {
        await addBriefingCompleteTag(uid);
      } else {
        await removeBriefingCompleteTag(uid);
      }
      results.push({ contactId: c.id, name: displayName, uid, success: true });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ contactId: c.id, name: displayName, uid, success: false, error: errMsg });
      await logAutomationError({
        source: action === "add" ? "slp-tag-briefing-complete-add" : "slp-tag-briefing-complete-remove",
        message: `概要案内完了タグ${action === "add" ? "付与" : "削除"}失敗: ${displayName} (uid=${uid})`,
        detail: {
          error: errMsg,
          uid,
          contactId: c.id,
          name: displayName,
          retryAction: action === "add" ? "tag-briefing-complete-add" : "tag-briefing-complete-remove",
        },
      });
    }
  }
  return results;
}

/** 単一担当者に対してタグ操作を実行 */
async function applyTagToContact(
  contactId: number,
  action: "add" | "remove"
): Promise<TagResult | null> {
  const contact = await prisma.slpCompanyContact.findUnique({
    where: { id: contactId },
    include: { lineFriend: { select: { uid: true, snsname: true } } },
  });
  if (!contact) return null;
  const uid = contact.lineFriend?.uid;
  if (!uid) return null;
  const displayName = contact.name ?? contact.lineFriend?.snsname ?? "(名前なし)";
  try {
    if (action === "add") {
      await addBriefingCompleteTag(uid);
    } else {
      await removeBriefingCompleteTag(uid);
    }
    return { contactId, name: displayName, uid, success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await logAutomationError({
      source: action === "add" ? "slp-tag-briefing-complete-add" : "slp-tag-briefing-complete-remove",
      message: `概要案内完了タグ${action === "add" ? "付与" : "削除"}失敗: ${displayName} (uid=${uid})`,
      detail: {
        error: errMsg,
        uid,
        contactId,
        name: displayName,
        retryAction: action === "add" ? "tag-briefing-complete-add" : "tag-briefing-complete-remove",
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

export async function addCompanyRecord(): Promise<{ id: number }> {
  const created = await prisma.slpCompanyRecord.create({ data: {} });
  revalidatePath("/slp/companies");
  return { id: created.id };
}

/**
 * 企業名簿レコードの「概要案内」関連を部分更新する（既存）。
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
  }
) {
  const data: {
    briefingStatus?: string | null;
    briefingBookedAt?: Date | null;
    briefingDate?: Date | null;
    briefingStaffId?: number | null;
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
  referrerText?: string | null;
  salesStaffId?: number | null;
  asStaffId?: number | null;
  status1Id?: number | null;
  status2Id?: number | null;
  lastContactDate?: string | null;
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
    "referrerText",
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
  if (patch.asStaffId !== undefined) {
    data.asStaffId = patch.asStaffId !== null ? patch.asStaffId : null;
  }
  if (patch.status1Id !== undefined) {
    data.status1Id = patch.status1Id !== null ? patch.status1Id : null;
  }
  if (patch.status2Id !== undefined) {
    data.status2Id = patch.status2Id !== null ? patch.status2Id : null;
  }

  await prisma.slpCompanyRecord.update({
    where: { id },
    data,
  });
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
): Promise<MasterItem> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("名称を入力してください");
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
    throw new Error(`同じ${label}名「${trimmed}」が既に登録されています`);
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
  return result;
}

/** マスタ更新（名称・有効フラグ） */
export async function updateMasterOption(
  kind: MasterKind,
  id: number,
  patch: { name?: string; isActive?: boolean }
): Promise<void> {
  const data: { name?: string; isActive?: boolean } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error("名称を入力してください");
    data.name = trimmed;
  }
  if (patch.isActive !== undefined) {
    data.isActive = patch.isActive;
  }
  if (Object.keys(data).length === 0) return;

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
}

/** マスタ削除（使用中の場合はエラー） */
export async function deleteMasterOption(kind: MasterKind, id: number): Promise<void> {
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
    throw new Error(`この${label}は${usageCount}件の企業名簿で使用中のため削除できません`);
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
}): Promise<{ tagResult: TagResult | null }> {
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
  let tagResult: TagResult | null = null;
  if (data.lineFriendId !== null) {
    const record = await prisma.slpCompanyRecord.findUnique({
      where: { id: data.companyRecordId },
      select: { briefingStatus: true },
    });
    if (record?.briefingStatus === "完了") {
      tagResult = await applyTagToContact(created.id, "add");
    }
  }

  revalidatePath("/slp/companies");
  return { tagResult };
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
): Promise<{ tagResult: TagResult | null }> {
  // 変更前の状態を取得
  const before = await prisma.slpCompanyContact.findUnique({
    where: { id },
    include: {
      lineFriend: { select: { uid: true } },
      companyRecord: { select: { briefingStatus: true } },
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

  // タグ連動: 親企業が「完了」状態かつ lineFriendId が変わった場合
  let tagResult: TagResult | null = null;
  if (before?.companyRecord.briefingStatus === "完了") {
    const oldUid = before.lineFriend?.uid ?? null;
    const oldLineFriendId = before.lineFriendId;

    // 旧LINE友達のタグを削除（紐付けがあった場合）
    if (oldUid && oldLineFriendId !== data.lineFriendId) {
      try {
        await removeBriefingCompleteTag(oldUid);
      } catch (e) {
        await logAutomationError({
          source: "slp-tag-briefing-complete-remove",
          message: `旧担当者のタグ削除失敗: contactId=${id}, uid=${oldUid}`,
          detail: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }

    // 新LINE友達にタグ付与（新規紐付け or 別LINEへ変更）
    if (data.lineFriendId !== null && data.lineFriendId !== oldLineFriendId) {
      tagResult = await applyTagToContact(id, "add");
    }
  }

  revalidatePath("/slp/companies");
  return { tagResult };
}

export async function deleteContact(id: number): Promise<{ tagResult: TagResult | null }> {
  // 削除前の情報を取得
  const contact = await prisma.slpCompanyContact.findUnique({
    where: { id },
    include: {
      lineFriend: { select: { uid: true, snsname: true } },
      companyRecord: { select: { briefingStatus: true } },
    },
  });

  // 完了状態の企業から LINE紐付け済の担当者を削除する場合はタグ削除
  let tagResult: TagResult | null = null;
  if (
    contact?.companyRecord.briefingStatus === "完了" &&
    contact.lineFriend?.uid
  ) {
    const uid = contact.lineFriend.uid;
    const displayName = contact.name ?? contact.lineFriend.snsname ?? "(名前なし)";
    try {
      await removeBriefingCompleteTag(uid);
      tagResult = { contactId: id, name: displayName, uid, success: true };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      tagResult = { contactId: id, name: displayName, uid, success: false, error: errMsg };
      await logAutomationError({
        source: "slp-tag-briefing-complete-remove",
        message: `削除担当者のタグ削除失敗: contactId=${id}, uid=${uid}`,
        detail: { error: errMsg },
      });
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
  return { tagResult };
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

/**
 * ステータスを変更し、変更履歴を記録する。
 * 「予約中 → 完了」以外の変更時は理由が必須。
 *
 * タグ連動:
 *   - fromStatus !== "完了" && toStatus === "完了" → 全担当者にタグ付与
 *   - fromStatus === "完了" && toStatus !== "完了" → 全担当者からタグ削除
 */
export async function changeStatusWithReason(
  recordId: number,
  toStatus: string,
  reason: string
): Promise<{ tagResults: TagResult[] }> {
  if (!reason.trim()) {
    throw new Error("変更理由は必須です");
  }

  const current = await prisma.slpCompanyRecord.findUnique({
    where: { id: recordId },
    select: { briefingStatus: true },
  });
  const fromStatus = current?.briefingStatus ?? null;

  const staffId = await getCurrentStaffId();

  await prisma.$transaction([
    prisma.slpCompanyRecord.update({
      where: { id: recordId },
      data: { briefingStatus: toStatus },
    }),
    prisma.slpCompanyRecordStatusHistory.create({
      data: {
        recordId,
        fromStatus,
        toStatus,
        reason: reason.trim(),
        changedById: staffId,
      },
    }),
  ]);

  // タグ連動
  let tagResults: TagResult[] = [];
  if (fromStatus !== "完了" && toStatus === "完了") {
    tagResults = await applyTagToAllContacts(recordId, "add");
  } else if (fromStatus === "完了" && toStatus !== "完了") {
    tagResults = await applyTagToAllContacts(recordId, "remove");
  }

  revalidatePath("/slp/companies");
  return { tagResults };
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
      data: { briefingStatus: "完了" },
    }),
    prisma.slpCompanyRecordStatusHistory.create({
      data: {
        recordId,
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
    result.tagResults = await applyTagToAllContacts(recordId, "add");
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
export async function softDeleteCompanyDocument(documentId: number): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("認証が必要です");
  }
  await prisma.slpCompanyDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/slp/companies");
}
