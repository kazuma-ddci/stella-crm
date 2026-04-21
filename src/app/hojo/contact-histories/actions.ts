"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import { ok, err, type ActionResult } from "@/lib/action-result";
import {
  contactHistoryIncludeForDisplay,
  formatHojoContactHistory,
  type HojoContactTargetType,
} from "./format";

// HOJOの顧客種別システムコード
const CUSTOMER_TYPE_HOJO_VENDOR_CODE = "hojo_vendor";
const CUSTOMER_TYPE_HOJO_BBS_CODE = "hojo_bbs";
const CUSTOMER_TYPE_HOJO_LENDER_CODE = "hojo_lender";
const CUSTOMER_TYPE_HOJO_OTHER_CODE = "hojo_other";

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
  assignedTo?: string | null;
  customerParticipants?: string | null;
  meetingMinutes?: string | null;
  note?: string | null;
  customerTypeIds?: number[];
  files?: FileInput[];
};

// 活動記録ページ用 unified 入力（ベンダーFK同時紐付け対応）
type UnifiedContactHistoryInput = ContactHistoryInput & {
  vendorId?: number | null;
};

// ============================================
// ベンダー接触履歴
// ============================================

export async function addHojoVendorContactHistory(
  vendorId: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  const vendor = await prisma.hojoVendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendor) throw new Error("ベンダーが見つかりません");

  const defaultCustomerTypeId = await getCustomerTypeIdByCode(
    CUSTOMER_TYPE_HOJO_VENDOR_CODE
  );
  const customerTypeIds = ensureCustomerType(
    data.customerTypeIds,
    defaultCustomerTypeId
  );

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.hojoContactHistory.create({
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        contactCategoryId: data.contactCategoryId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
        targetType: "vendor",
        vendorId,
      },
    });
    await tx.hojoContactHistoryTag.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });
    if (data.files && data.files.length > 0) {
      await tx.hojoContactHistoryFile.createMany({
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

  revalidatePath(`/hojo/settings/vendors/${vendorId}`);
  revalidatePath("/hojo/records/contact-histories");
  return formatHojoContactHistory(result!);
}

// ============================================
// BBS接触履歴（FK無し、顧客種別タグ=BBSで分類）
// ============================================

export async function addHojoBbsContactHistory(
  _unused: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  const defaultCustomerTypeId = await getCustomerTypeIdByCode(
    CUSTOMER_TYPE_HOJO_BBS_CODE
  );
  const customerTypeIds = ensureCustomerType(
    data.customerTypeIds,
    defaultCustomerTypeId
  );

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.hojoContactHistory.create({
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        contactCategoryId: data.contactCategoryId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
        targetType: "bbs",
      },
    });
    await tx.hojoContactHistoryTag.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });
    if (data.files && data.files.length > 0) {
      await tx.hojoContactHistoryFile.createMany({
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

  revalidatePath("/hojo/contact-histories/bbs");
  revalidatePath("/hojo/records/contact-histories");
  return formatHojoContactHistory(result!);
}

// ============================================
// 貸金業社接触履歴（FK無し、顧客種別タグ=貸金業社で分類）
// ============================================

export async function addHojoLenderContactHistory(
  _unused: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  const defaultCustomerTypeId = await getCustomerTypeIdByCode(
    CUSTOMER_TYPE_HOJO_LENDER_CODE
  );
  const customerTypeIds = ensureCustomerType(
    data.customerTypeIds,
    defaultCustomerTypeId
  );

  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.hojoContactHistory.create({
      data: {
        contactDate: new Date(data.contactDate!),
        contactMethodId: data.contactMethodId || null,
        contactCategoryId: data.contactCategoryId || null,
        assignedTo: data.assignedTo || null,
        customerParticipants: data.customerParticipants || null,
        meetingMinutes: data.meetingMinutes || null,
        note: data.note || null,
        targetType: "lender",
      },
    });
    await tx.hojoContactHistoryTag.createMany({
      data: customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });
    if (data.files && data.files.length > 0) {
      await tx.hojoContactHistoryFile.createMany({
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

  revalidatePath("/hojo/contact-histories/lender");
  revalidatePath("/hojo/records/contact-histories");
  return formatHojoContactHistory(result!);
}

// ============================================
// その他顧客種別の接触履歴（活動記録ページから新規登録）
// 相手先エンティティに紐付かない、相手名はテキストで記録
// ============================================

export async function addHojoOtherContactHistory(
  _unused: number, // Modalインターフェース互換のため
  data: ContactHistoryInput
): Promise<ActionResult<Record<string, unknown>>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const defaultCustomerTypeId = await getCustomerTypeIdByCode(
      CUSTOMER_TYPE_HOJO_OTHER_CODE
    );
    const customerTypeIds = ensureCustomerType(
      data.customerTypeIds,
      defaultCustomerTypeId
    );

    const result = await prisma.$transaction(async (tx) => {
      const history = await tx.hojoContactHistory.create({
        data: {
          contactDate: new Date(data.contactDate!),
          contactMethodId: data.contactMethodId || null,
          contactCategoryId: data.contactCategoryId || null,
          assignedTo: data.assignedTo || null,
          customerParticipants: data.customerParticipants || null,
          meetingMinutes: data.meetingMinutes || null,
          note: data.note || null,
          targetType: "other",
        },
      });
      await tx.hojoContactHistoryTag.createMany({
        data: customerTypeIds.map((customerTypeId) => ({
          contactHistoryId: history.id,
          customerTypeId,
        })),
      });
      if (data.files && data.files.length > 0) {
        await tx.hojoContactHistoryFile.createMany({
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

    revalidatePath("/hojo/records/contact-histories");
    return ok(formatHojoContactHistory(result!));
  } catch (e) {
    console.error("[addHojoOtherContactHistory]", e);
    return err(e instanceof Error ? e.message : "登録に失敗しました");
  }
}

// ============================================
// 活動記録ページ用 unified 追加
// 顧客種別タグ駆動。targetType は priority 順で自動決定
// vendor > bbs > lender > other
// ============================================

export async function addHojoContactHistoryUnified(
  data: UnifiedContactHistoryInput
): Promise<ActionResult<Record<string, unknown>>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    if (!data.contactDate) {
      return err("接触日時は必須です");
    }
    if (!data.customerTypeIds || data.customerTypeIds.length === 0) {
      return err("顧客種別を1つ以上選択してください");
    }

    // seed必須の顧客種別なので、取得失敗時はマスターデータ不整合として明示的にエラー
    let vendorTypeId: number;
    let bbsId: number;
    let lenderId: number;
    let otherId: number;
    try {
      [vendorTypeId, bbsId, lenderId, otherId] = await Promise.all([
        getCustomerTypeIdByCode(CUSTOMER_TYPE_HOJO_VENDOR_CODE),
        getCustomerTypeIdByCode(CUSTOMER_TYPE_HOJO_BBS_CODE),
        getCustomerTypeIdByCode(CUSTOMER_TYPE_HOJO_LENDER_CODE),
        getCustomerTypeIdByCode(CUSTOMER_TYPE_HOJO_OTHER_CODE),
      ]);
    } catch (e) {
      console.error("[addHojoContactHistoryUnified] customer type master lookup failed", e);
      return err("補助金顧客種別マスターが不正です。管理者にお問い合わせください。");
    }

    const tagSet = new Set(data.customerTypeIds);

    // HOJO顧客種別が最低1つ選択されているかチェック
    const hasHojoType =
      tagSet.has(vendorTypeId) ||
      tagSet.has(bbsId) ||
      tagSet.has(lenderId) ||
      tagSet.has(otherId);
    if (!hasHojoType) {
      return err(
        "補助金の顧客種別（ベンダー・BBS・貸金業社・その他）を1つ以上選択してください"
      );
    }

    // エンティティ選択のバリデーション
    if (tagSet.has(vendorTypeId) && !data.vendorId) {
      return err("「ベンダー」を選択した場合はベンダーを選んでください");
    }

    let targetType: string;
    if (tagSet.has(vendorTypeId) && data.vendorId) {
      targetType = "vendor";
    } else if (tagSet.has(bbsId)) {
      targetType = "bbs";
    } else if (tagSet.has(lenderId)) {
      targetType = "lender";
    } else {
      targetType = "other";
    }

    const result = await prisma.$transaction(async (tx) => {
      const history = await tx.hojoContactHistory.create({
        data: {
          contactDate: new Date(data.contactDate!),
          contactMethodId: data.contactMethodId || null,
          contactCategoryId: data.contactCategoryId || null,
          assignedTo: data.assignedTo || null,
          customerParticipants: data.customerParticipants || null,
          meetingMinutes: data.meetingMinutes || null,
          note: data.note || null,
          targetType,
          vendorId: data.vendorId ?? null,
        },
      });
      if (data.customerTypeIds!.length > 0) {
        await tx.hojoContactHistoryTag.createMany({
          data: data.customerTypeIds!.map((customerTypeId) => ({
            contactHistoryId: history.id,
            customerTypeId,
          })),
        });
      }
      if (data.files && data.files.length > 0) {
        await tx.hojoContactHistoryFile.createMany({
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

    revalidatePath("/hojo/records/contact-histories");
    if (data.vendorId) {
      revalidatePath(`/hojo/settings/vendors/${data.vendorId}`);
    }
    if (targetType === "bbs") {
      revalidatePath("/hojo/contact-histories/bbs");
    }
    if (targetType === "lender") {
      revalidatePath("/hojo/contact-histories/lender");
    }
    return ok(formatHojoContactHistory(result!));
  } catch (e) {
    console.error("[addHojoContactHistoryUnified]", e);
    return err(e instanceof Error ? e.message : "登録に失敗しました");
  }
}

// ============================================
// 共通 更新 / 削除
// ============================================

export async function updateHojoContactHistory(
  id: number,
  data: ContactHistoryInput
) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  const result = await prisma.$transaction(async (tx) => {
    const history = await tx.hojoContactHistory.update({
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
      },
    });

    if (data.customerTypeIds !== undefined) {
      await tx.hojoContactHistoryTag.deleteMany({
        where: { contactHistoryId: id },
      });
      if (data.customerTypeIds.length > 0) {
        await tx.hojoContactHistoryTag.createMany({
          data: data.customerTypeIds.map((customerTypeId) => ({
            contactHistoryId: id,
            customerTypeId,
          })),
        });
      }
    }

    if (data.files !== undefined) {
      const existing = await tx.hojoContactHistoryFile.findMany({
        where: { contactHistoryId: id },
        select: { id: true },
      });
      const existingIds = existing.map((f) => f.id);
      const submittedIds = data.files.filter((f) => f.id).map((f) => f.id!);
      const toDelete = existingIds.filter((i) => !submittedIds.includes(i));
      if (toDelete.length > 0) {
        await tx.hojoContactHistoryFile.deleteMany({
          where: { id: { in: toDelete } },
        });
      }
      const newOnes = data.files.filter((f) => !f.id);
      if (newOnes.length > 0) {
        await tx.hojoContactHistoryFile.createMany({
          data: newOnes.map((f) => ({
            contactHistoryId: id,
            filePath: f.filePath ?? null,
            fileName: f.fileName,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType ?? null,
            url: f.url ?? null,
          })),
        });
      }
    }

    return loadHistory(tx, history.id);
  });

  revalidatePath("/hojo/records/contact-histories");
  if (result?.vendorId) {
    revalidatePath(`/hojo/settings/vendors/${result.vendorId}`);
  }
  if (result?.targetType === "bbs") {
    revalidatePath("/hojo/contact-histories/bbs");
  }
  if (result?.targetType === "lender") {
    revalidatePath("/hojo/contact-histories/lender");
  }

  return formatHojoContactHistory(result!);
}

export async function deleteHojoContactHistory(id: number): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  const history = await prisma.hojoContactHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { vendorId: true, targetType: true },
  });

  revalidatePath("/hojo/records/contact-histories");
  if (history.vendorId) {
    revalidatePath(`/hojo/settings/vendors/${history.vendorId}`);
  }
  if (history.targetType === "bbs") {
    revalidatePath("/hojo/contact-histories/bbs");
  }
  if (history.targetType === "lender") {
    revalidatePath("/hojo/contact-histories/lender");
  }
}

// ============================================
// 取得系
// ============================================

export async function getHojoContactHistoriesByVendor(vendorId: number) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  const rows = await prisma.hojoContactHistory.findMany({
    where: { vendorId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}

export async function getHojoContactHistoriesByBbs() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  const rows = await prisma.hojoContactHistory.findMany({
    where: { targetType: "bbs", deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}

export async function getHojoContactHistoriesByLender() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);
  const rows = await prisma.hojoContactHistory.findMany({
    where: { targetType: "lender", deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}

export async function listHojoContactHistories(filters?: {
  targetType?: HojoContactTargetType;
  customerTypeId?: number; // 顧客種別タグフィルタ（新規）
  dateFrom?: string;
  dateTo?: string;
  staffId?: number;
  contactMethodId?: number;
  contactCategoryId?: number;
}) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);

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
      ...(filters.dateTo
        ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) }
        : {}),
    };
  }
  if (filters?.contactMethodId) where.contactMethodId = filters.contactMethodId;
  if (filters?.contactCategoryId) where.contactCategoryId = filters.contactCategoryId;

  const rows = await prisma.hojoContactHistory.findMany({
    where,
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });

  let result = rows.map(formatHojoContactHistory);

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
// ヘルパー
// ============================================

function ensureCustomerType(
  ids: number[] | undefined,
  fallback: number
): number[] {
  const list = [...(ids ?? [])];
  if (fallback > 0 && !list.includes(fallback)) list.push(fallback);
  return list;
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function loadHistory(tx: PrismaTx, id: number) {
  return await tx.hojoContactHistory.findUnique({
    where: { id },
    include: contactHistoryIncludeForDisplay,
  });
}
