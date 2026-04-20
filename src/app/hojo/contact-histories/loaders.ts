import { prisma } from "@/lib/prisma";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import {
  contactHistoryIncludeForDisplay,
  formatHojoContactHistory,
} from "./format";

/**
 * HOJO接触履歴モーダル用のマスタデータ一式を取得する。
 * ベンダー詳細・BBS接触履歴・貸金業社接触履歴・活動記録ページで共通利用。
 */
export async function loadHojoContactHistoryMasters() {
  const [contactMethods, customerTypes, contactCategories, hojoProject, allProjects] =
    await Promise.all([
      prisma.contactMethod.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.customerType.findMany({
        where: { isActive: true, project: { code: "hojo" } },
        include: {
          project: { select: { id: true, code: true, name: true, displayOrder: true } },
        },
        orderBy: [{ displayOrder: "asc" }],
      }),
      prisma.contactCategory.findMany({
        where: { isActive: true, project: { code: "hojo" } },
        include: {
          project: { select: { id: true, code: true, name: true, displayOrder: true } },
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.masterProject.findFirst({ where: { code: "hojo" }, select: { id: true } }),
      prisma.masterProject.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
      }),
    ]);

  // HOJOプロジェクトタグがついているスタッフ
  const hojoStaff = hojoProject
    ? await prisma.staffProjectAssignment.findMany({
        where: { projectId: hojoProject.id },
        select: {
          staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
        },
      })
    : [];
  const staffList = hojoStaff
    .filter((a) => a.staff.isActive && !a.staff.isSystemUser)
    .map((a) => ({ id: a.staff.id, name: a.staff.name }));
  const staffOptions = staffList.map((s) => ({ value: String(s.id), label: s.name }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  // プロジェクトIDごとの担当者候補（クロスプロジェクト対応）
  const staffByProject: Record<number, { value: string; label: string }[]> = {};
  for (const p of allProjects) {
    const assignments = await prisma.staffProjectAssignment.findMany({
      where: { projectId: p.id },
      select: {
        staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
      },
    });
    staffByProject[p.id] = assignments
      .filter((a) => a.staff.isActive && !a.staff.isSystemUser)
      .map((a) => ({ value: String(a.staff.id), label: a.staff.name }));
  }

  const [
    hojoVendorCustomerTypeId,
    hojoBbsCustomerTypeId,
    hojoLenderCustomerTypeId,
    hojoOtherCustomerTypeId,
  ] = await Promise.all([
    getCustomerTypeIdByCode("hojo_vendor").catch(() => 0),
    getCustomerTypeIdByCode("hojo_bbs").catch(() => 0),
    getCustomerTypeIdByCode("hojo_lender").catch(() => 0),
    getCustomerTypeIdByCode("hojo_other").catch(() => 0),
  ]);

  return {
    contactMethodOptions,
    staffOptions,
    customerTypes: customerTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      code: ct.code,
      projectId: ct.projectId,
      displayOrder: ct.displayOrder,
      project: {
        id: ct.project.id,
        name: ct.project.name,
        displayOrder: ct.project.displayOrder,
      },
    })),
    staffByProject,
    contactCategories: contactCategories.map((cc) => ({
      id: cc.id,
      name: cc.name,
      projectId: cc.projectId,
      project: {
        id: cc.project.id,
        name: cc.project.name,
        displayOrder: cc.project.displayOrder,
      },
    })),
    hojoVendorCustomerTypeId,
    hojoBbsCustomerTypeId,
    hojoLenderCustomerTypeId,
    hojoOtherCustomerTypeId,
  };
}

/**
 * 活動記録ページ用のベンダー一覧（追加モーダルのセレクト）
 */
export async function loadActiveHojoVendorOptions() {
  const vendors = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  return vendors.map((v) => ({ value: String(v.id), label: v.name }));
}

/**
 * 特定のベンダーに紐づく接触履歴を取得（表示用に整形）
 */
export async function loadContactHistoriesForVendor(vendorId: number) {
  const rows = await prisma.hojoContactHistory.findMany({
    where: { vendorId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}

/**
 * BBS の接触履歴を取得（targetType=bbs でフィルタ、顧客種別タグで分類）
 */
export async function loadContactHistoriesForBbs() {
  const rows = await prisma.hojoContactHistory.findMany({
    where: { targetType: "bbs", deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}

/**
 * 貸金業社の接触履歴を取得（targetType=lender でフィルタ、顧客種別タグで分類）
 */
export async function loadContactHistoriesForLender() {
  const rows = await prisma.hojoContactHistory.findMany({
    where: { targetType: "lender", deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatHojoContactHistory);
}
