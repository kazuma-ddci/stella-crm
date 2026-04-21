"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  contactHistoryIncludeForDisplay,
  formatSlpContactHistory,
  type SlpContactTargetType,
} from "./format";

// SLPの顧客種別システムコード
const CUSTOMER_TYPE_SLP_COMPANY_CODE = "slp_company";
const CUSTOMER_TYPE_SLP_AGENCY_CODE = "slp_agency";
const CUSTOMER_TYPE_SLP_OTHER_CODE = "slp_other";

type FileInput = {
  id?: number;
  filePath?: string | null;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  url?: string | null;
};

type ContactHistoryInput = {
  contactDate?: string;
  contactMethodId?: number | null;
  contactCategoryId?: number | null;
  assignedTo?: string | null; // スタッフIDをカンマ区切りで保存
  customerParticipants?: string | null;
  meetingMinutes?: string | null;
  note?: string | null;
  customerTypeIds?: number[]; // 顧客種別ID配列
  lineFriendIds?: number[];   // LINEユーザー（複数選択）
  files?: FileInput[];        // 添付ファイル
  sessionId?: number | null;  // 打ち合わせ(SlpMeetingSession)への紐付け（任意）
};

// 活動記録ページ用 unified 入力（複数エンティティ紐付け対応）
type UnifiedContactHistoryInput = ContactHistoryInput & {
  companyRecordId?: number | null;
  agencyId?: number | null;
};

// ============================================
// 事業者名簿の接触履歴
// ============================================

export async function addSlpCompanyRecordContactHistory(
  companyRecordId: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const record = await prisma.slpCompanyRecord.findUnique({
    where: { id: companyRecordId },
    select: { masterCompanyId: true },
  });
  if (!record) throw new Error("事業者レコードが見つかりません");

  const defaultCustomerTypeId = await getCustomerTypeIdByCode(
    CUSTOMER_TYPE_SLP_COMPANY_CODE
  );
  const customerTypeIds = ensureCustomerType(
    data.customerTypeIds,
    defaultCustomerTypeId
  );

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.slpContactHistory.create({
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        contactCategoryId: data.contactCategoryId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
        targetType: "company_record",
        companyRecordId,
        masterCompanyId: record.masterCompanyId,
        sessionId: await resolveSessionId(tx, data.sessionId, companyRecordId),
      },
    });
    await tx.slpContactHistoryTag.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });
    if (data.files && data.files.length > 0) {
      await tx.slpContactHistoryFile.createMany({
        data: data.files.map((f) => ({
          contactHistoryId: history.id,
          filePath: f.filePath ?? null,
          fileName: f.fileName,
          fileSize: f.fileSize ?? null,
          mimeType: f.mimeType ?? null,
          url: f.url ?? null,
        })),
      });
    }
    return loadHistory(tx, history.id);
  });

  revalidatePath(`/slp/companies/${companyRecordId}`);
  revalidatePath("/slp/records/contact-histories");
  return formatSlpContactHistory(result!);
}

// ============================================
// 代理店管理の接触履歴
// ============================================

export async function addSlpAgencyContactHistory(
  agencyId: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const agency = await prisma.slpAgency.findUnique({
    where: { id: agencyId },
    select: { masterCompanyId: true },
  });
  if (!agency) throw new Error("代理店が見つかりません");

  const defaultCustomerTypeId = await getCustomerTypeIdByCode(
    CUSTOMER_TYPE_SLP_AGENCY_CODE
  );
  const customerTypeIds = ensureCustomerType(
    data.customerTypeIds,
    defaultCustomerTypeId
  );

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.slpContactHistory.create({
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        contactCategoryId: data.contactCategoryId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
        targetType: "agency",
        agencyId,
        masterCompanyId: agency.masterCompanyId,
      },
    });
    await tx.slpContactHistoryTag.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });
    if (data.files && data.files.length > 0) {
      await tx.slpContactHistoryFile.createMany({
        data: data.files.map((f) => ({
          contactHistoryId: history.id,
          filePath: f.filePath ?? null,
          fileName: f.fileName,
          fileSize: f.fileSize ?? null,
          mimeType: f.mimeType ?? null,
          url: f.url ?? null,
        })),
      });
    }
    return loadHistory(tx, history.id);
  });

  revalidatePath(`/slp/agencies/${agencyId}`);
  revalidatePath("/slp/records/contact-histories");
  return formatSlpContactHistory(result!);
}

// ============================================
// LINEユーザーの接触履歴（集約ページから新規登録）
// 複数選択可・0人（紐付けなし）も許容
// ============================================

export async function addSlpLineUsersContactHistory(
  _unused: number, // Modalインターフェース互換のため（使用しない）
  data: ContactHistoryInput
): Promise<ActionResult<Record<string, unknown>>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const lineFriendIds = data.lineFriendIds ?? [];
    const customerTypeIds = data.customerTypeIds ?? [];

    const result = await prisma.$transaction(async (tx) => {
      const history = await tx.slpContactHistory.create({
        data: {
          contactDate: new Date(data.contactDate!),
          contactMethodId: data.contactMethodId || null,
          contactCategoryId: data.contactCategoryId || null,
          assignedTo: data.assignedTo || null,
          customerParticipants: data.customerParticipants || null,
          meetingMinutes: data.meetingMinutes || null,
          note: data.note || null,
          targetType: "line_users",
        },
      });
      if (customerTypeIds.length > 0) {
        await tx.slpContactHistoryTag.createMany({
          data: customerTypeIds.map((customerTypeId) => ({
            contactHistoryId: history.id,
            customerTypeId,
          })),
        });
      }
      if (lineFriendIds.length > 0) {
        await tx.slpContactHistoryLineFriend.createMany({
          data: lineFriendIds.map((lineFriendId) => ({
            contactHistoryId: history.id,
            lineFriendId,
          })),
        });
      }
      if (data.files && data.files.length > 0) {
        await tx.slpContactHistoryFile.createMany({
          data: data.files.map((f) => ({
            contactHistoryId: history.id,
            filePath: f.filePath,
            fileName: f.fileName,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
          })),
        });
      }
      return loadHistory(tx, history.id);
    });

    revalidatePath("/slp/records/contact-histories");
    return ok(formatSlpContactHistory(result!));
  } catch (e) {
    console.error("[addSlpLineUsersContactHistory]", e);
    return err(e instanceof Error ? e.message : "登録に失敗しました");
  }
}

// ============================================
// 活動記録ページ用 unified 追加
// 複数エンティティ（事業者 + 代理店等）同時紐付け対応
// targetType は priority 順で自動決定: company_record > agency > line_users > other
// ============================================

export async function addSlpContactHistoryUnified(
  data: UnifiedContactHistoryInput
): Promise<ActionResult<Record<string, unknown>>> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    if (!data.contactDate) {
      return err("接触日時は必須です");
    }
    if (!data.customerTypeIds || data.customerTypeIds.length === 0) {
      return err("顧客種別を1つ以上選択してください");
    }

    // priority順で targetType 自動決定
    // seed必須の顧客種別なので、取得失敗時はマスターデータ不整合として明示的にエラー
    let slpCompanyId: number;
    let slpAgencyId: number;
    let slpOtherId: number;
    let slpLineUsersId: number;
    try {
      [slpCompanyId, slpAgencyId, slpOtherId, slpLineUsersId] = await Promise.all([
        getCustomerTypeIdByCode(CUSTOMER_TYPE_SLP_COMPANY_CODE),
        getCustomerTypeIdByCode(CUSTOMER_TYPE_SLP_AGENCY_CODE),
        getCustomerTypeIdByCode(CUSTOMER_TYPE_SLP_OTHER_CODE),
        getCustomerTypeIdByCode("slp_line_users"),
      ]);
    } catch (e) {
      console.error("[addSlpContactHistoryUnified] customer type master lookup failed", e);
      return err("SLP顧客種別マスターが不正です。管理者にお問い合わせください。");
    }

    const tagSet = new Set(data.customerTypeIds);

    // SLP顧客種別が最低1つ選択されているかチェック
    const hasSlpType =
      tagSet.has(slpCompanyId) ||
      tagSet.has(slpAgencyId) ||
      tagSet.has(slpLineUsersId) ||
      tagSet.has(slpOtherId);
    if (!hasSlpType) {
      return err(
        "SLPの顧客種別（事業者・代理店・LINEユーザー・その他）を1つ以上選択してください"
      );
    }

    // エンティティ選択のバリデーション
    if (tagSet.has(slpCompanyId) && !data.companyRecordId) {
      return err("「事業者」を選択した場合は事業者を選んでください");
    }
    if (tagSet.has(slpAgencyId) && !data.agencyId) {
      return err("「代理店」を選択した場合は代理店を選んでください");
    }
    if (
      tagSet.has(slpLineUsersId) &&
      (!data.lineFriendIds || data.lineFriendIds.length === 0)
    ) {
      return err("「LINEユーザー」を選択した場合は1名以上のLINE友達を選んでください");
    }

    let targetType: string;
    if (tagSet.has(slpCompanyId) && data.companyRecordId) {
      targetType = "company_record";
    } else if (tagSet.has(slpAgencyId) && data.agencyId) {
      targetType = "agency";
    } else if (tagSet.has(slpLineUsersId)) {
      targetType = "line_users";
    } else {
      targetType = "other";
    }

    // 事業者/代理店の masterCompanyId 解決
    let masterCompanyId: number | null = null;
    if (data.companyRecordId) {
      const rec = await prisma.slpCompanyRecord.findUnique({
        where: { id: data.companyRecordId },
        select: { masterCompanyId: true },
      });
      masterCompanyId = rec?.masterCompanyId ?? null;
    } else if (data.agencyId) {
      const agency = await prisma.slpAgency.findUnique({
        where: { id: data.agencyId },
        select: { masterCompanyId: true },
      });
      masterCompanyId = agency?.masterCompanyId ?? null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // sessionId は companyRecord に紐付く場合のみ有効
      const sessionIdToSave = data.companyRecordId
        ? await resolveSessionId(tx, data.sessionId, data.companyRecordId)
        : null;

      const history = await tx.slpContactHistory.create({
        data: {
          contactDate: new Date(data.contactDate!),
          contactMethodId: data.contactMethodId || null,
          contactCategoryId: data.contactCategoryId || null,
          assignedTo: data.assignedTo || null,
          customerParticipants: data.customerParticipants || null,
          meetingMinutes: data.meetingMinutes || null,
          note: data.note || null,
          targetType,
          companyRecordId: data.companyRecordId ?? null,
          agencyId: data.agencyId ?? null,
          masterCompanyId,
          sessionId: sessionIdToSave,
        },
      });
      if (data.customerTypeIds!.length > 0) {
        await tx.slpContactHistoryTag.createMany({
          data: data.customerTypeIds!.map((customerTypeId) => ({
            contactHistoryId: history.id,
            customerTypeId,
          })),
        });
      }
      if (data.lineFriendIds && data.lineFriendIds.length > 0) {
        await tx.slpContactHistoryLineFriend.createMany({
          data: data.lineFriendIds.map((lineFriendId) => ({
            contactHistoryId: history.id,
            lineFriendId,
          })),
        });
      }
      if (data.files && data.files.length > 0) {
        await tx.slpContactHistoryFile.createMany({
          data: data.files.map((f) => ({
            contactHistoryId: history.id,
            filePath: f.filePath ?? null,
            fileName: f.fileName,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            url: f.url ?? null,
          })),
        });
      }
      return loadHistory(tx, history.id);
    });

    revalidatePath("/slp/records/contact-histories");
    if (data.companyRecordId) {
      revalidatePath(`/slp/companies/${data.companyRecordId}`);
    }
    if (data.agencyId) {
      revalidatePath(`/slp/agencies/${data.agencyId}`);
    }
    return ok(formatSlpContactHistory(result!));
  } catch (e) {
    console.error("[addSlpContactHistoryUnified]", e);
    return err(e instanceof Error ? e.message : "登録に失敗しました");
  }
}

// ============================================
// 共通 更新 / 削除
// ============================================

export async function updateSlpContactHistory(
  id: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const result = await prisma.$transaction(async (tx) => {
    // sessionId が指定されている場合は同一 companyRecord に属するか検証
    let sessionIdToWrite: number | null | undefined = undefined;
    if (data.sessionId !== undefined) {
      const existing = await tx.slpContactHistory.findUnique({
        where: { id },
        select: { companyRecordId: true },
      });
      sessionIdToWrite = await resolveSessionId(
        tx,
        data.sessionId,
        existing?.companyRecordId ?? null
      );
    }

    const history = await tx.slpContactHistory.update({
      where: { id },
      data: {
        contactDate: data.contactDate ? new Date(data.contactDate) : undefined,
        contactMethodId: data.contactMethodId ?? null,
        contactCategoryId:
          data.contactCategoryId !== undefined
            ? data.contactCategoryId || null
            : undefined,
        assignedTo: data.assignedTo ?? null,
        customerParticipants: data.customerParticipants ?? null,
        meetingMinutes: data.meetingMinutes ?? null,
        note: data.note ?? null,
        ...(sessionIdToWrite !== undefined
          ? { sessionId: sessionIdToWrite }
          : {}),
      },
    });

    // 顧客種別タグの更新
    if (data.customerTypeIds !== undefined) {
      await tx.slpContactHistoryTag.deleteMany({
        where: { contactHistoryId: id },
      });
      if (data.customerTypeIds.length > 0) {
        await tx.slpContactHistoryTag.createMany({
          data: data.customerTypeIds.map((customerTypeId) => ({
            contactHistoryId: id,
            customerTypeId,
          })),
        });
      }
    }

    // LINEユーザー紐付けの更新（line_users のときのみ）
    if (data.lineFriendIds !== undefined && history.targetType === "line_users") {
      await tx.slpContactHistoryLineFriend.deleteMany({
        where: { contactHistoryId: id },
      });
      if (data.lineFriendIds.length > 0) {
        await tx.slpContactHistoryLineFriend.createMany({
          data: data.lineFriendIds.map((lineFriendId) => ({
            contactHistoryId: id,
            lineFriendId,
          })),
        });
      }
    }

    // ファイルの差分更新
    if (data.files !== undefined) {
      const existing = await tx.slpContactHistoryFile.findMany({
        where: { contactHistoryId: id },
        select: { id: true },
      });
      const existingIds = existing.map((f) => f.id);
      const submittedIds = data.files.filter((f) => f.id).map((f) => f.id!);
      const toDelete = existingIds.filter((i) => !submittedIds.includes(i));
      if (toDelete.length > 0) {
        await tx.slpContactHistoryFile.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
      const newOnes = data.files.filter((f) => !f.id);
      if (newOnes.length > 0) {
        await tx.slpContactHistoryFile.createMany({
          data: newOnes.map((f) => ({
            contactHistoryId: id,
            filePath: f.filePath,
            fileName: f.fileName,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
          })),
        });
      }
    }

    return loadHistory(tx, history.id);
  });

  revalidatePath("/slp/records/contact-histories");
  if (result?.companyRecordId) {
    revalidatePath(`/slp/companies/${result.companyRecordId}`);
  }
  if (result?.agencyId) {
    revalidatePath(`/slp/agencies/${result.agencyId}`);
  }

  return formatSlpContactHistory(result!);
}

export async function deleteSlpContactHistory(id: number): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const history = await prisma.slpContactHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { companyRecordId: true, agencyId: true },
  });

  revalidatePath("/slp/records/contact-histories");
  if (history.companyRecordId) {
    revalidatePath(`/slp/companies/${history.companyRecordId}`);
  }
  if (history.agencyId) {
    revalidatePath(`/slp/agencies/${history.agencyId}`);
  }
}

// ============================================
// 取得系
// ============================================

export async function getSlpContactHistoriesByCompanyRecord(
  companyRecordId: number
) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
  const rows = await prisma.slpContactHistory.findMany({
    where: { companyRecordId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatSlpContactHistory);
}

export async function getSlpContactHistoriesByAgency(agencyId: number) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
  const rows = await prisma.slpContactHistory.findMany({
    where: { agencyId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatSlpContactHistory);
}

// 特定の打ち合わせ（SlpMeetingSession）に紐づく接触履歴を取得
export async function getSlpContactHistoriesBySession(sessionId: number) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);
  const rows = await prisma.slpContactHistory.findMany({
    where: { sessionId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatSlpContactHistory);
}

// 集約ページ用。フィルタ対応
export async function listSlpContactHistories(filters?: {
  targetType?: SlpContactTargetType;
  customerTypeId?: number; // 顧客種別タグフィルタ
  dateFrom?: string;
  dateTo?: string;
  staffId?: number;
  contactMethodId?: number;
  contactCategoryId?: number;
}) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "view" }]);

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters?.targetType) {
    where.targetType = filters.targetType;
  }
  if (filters?.customerTypeId) {
    where.tags = { some: { customerTypeId: filters.customerTypeId } };
  }
  if (filters?.dateFrom || filters?.dateTo) {
    where.contactDate = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      // dateTo は当日の終端まで含める
      ...(filters.dateTo
        ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) }
        : {}),
    };
  }
  if (filters?.contactMethodId) where.contactMethodId = filters.contactMethodId;
  if (filters?.contactCategoryId) where.contactCategoryId = filters.contactCategoryId;

  const rows = await prisma.slpContactHistory.findMany({
    where,
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });

  let result = rows.map(formatSlpContactHistory);

  // 担当者フィルタ（assignedTo はカンマ区切り文字列なのでアプリ層で）
  if (filters?.staffId) {
    const sid = String(filters.staffId);
    result = result.filter(
      (r) =>
        r.assignedTo &&
        r.assignedTo.split(",").map((s) => s.trim()).includes(sid)
    );
  }

  return result;
}

// ============================================
// ヘルパー（同ファイル内でのみ使用）
// ============================================

function ensureCustomerType(
  ids: number[] | undefined,
  fallback: number
): number[] {
  const list = [...(ids ?? [])];
  if (!list.includes(fallback)) list.push(fallback);
  return list;
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// 接触履歴に指定される sessionId が、対象事業者の打ち合わせか検証する。
// 事業者に紐付かない場合や不正なIDは null を返す。
async function resolveSessionId(
  tx: PrismaTx,
  sessionId: number | null | undefined,
  companyRecordId: number | null
): Promise<number | null> {
  if (!sessionId) return null;
  if (!companyRecordId) return null;
  const s = await tx.slpMeetingSession.findUnique({
    where: { id: sessionId },
    select: { companyRecordId: true, deletedAt: true },
  });
  if (!s) return null;
  if (s.deletedAt) return null;
  if (s.companyRecordId !== companyRecordId) return null;
  return sessionId;
}

async function loadHistory(tx: PrismaTx, id: number) {
  return await tx.slpContactHistory.findUnique({
    where: { id },
    include: contactHistoryIncludeForDisplay,
  });
}
