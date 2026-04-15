import { prisma } from "@/lib/prisma";
import { getCustomerTypeIdByCode } from "@/lib/customer-type";
import {
  contactHistoryIncludeForDisplay,
  formatSlpContactHistory,
} from "./format";

/**
 * 接触履歴モーダル用のマスタデータ一式を取得する。
 * 事業者詳細ページ・代理店詳細ページ・集約ページで共通利用。
 */
export async function loadContactHistoryMasters() {
  const [contactMethods, customerTypes, contactCategories, slpProject, allProjects] =
    await Promise.all([
      prisma.contactMethod.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.customerType.findMany({
        where: { isActive: true },
        include: {
          project: { select: { id: true, code: true, name: true, displayOrder: true } },
        },
        orderBy: [{ projectId: "asc" }, { displayOrder: "asc" }],
      }),
      prisma.contactCategory.findMany({
        where: { isActive: true, project: { code: "slp" } },
        include: {
          project: { select: { id: true, code: true, name: true, displayOrder: true } },
        },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.masterProject.findFirst({ where: { code: "slp" }, select: { id: true } }),
      prisma.masterProject.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
      }),
    ]);

  // SLPプロジェクトの編集権限以上を持つスタッフ
  const slpStaff = slpProject
    ? await prisma.staffPermission.findMany({
        where: {
          projectId: slpProject.id,
          permissionLevel: { in: ["view", "edit", "manager"] },
        },
        select: {
          staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
        },
      })
    : [];
  const staffList = slpStaff
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));
  const staffOptions = staffList.map((s) => ({ value: String(s.id), label: s.name }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  // プロジェクトIDごとの担当者候補（クロスプロジェクト対応）
  const staffByProject: Record<number, { value: string; label: string }[]> = {};
  for (const p of allProjects) {
    const perms = await prisma.staffPermission.findMany({
      where: { projectId: p.id, permissionLevel: { in: ["view", "edit", "manager"] } },
      select: {
        staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
      },
    });
    staffByProject[p.id] = perms
      .filter((s) => s.staff.isActive && !s.staff.isSystemUser)
      .map((s) => ({ value: String(s.staff.id), label: s.staff.name }));
  }

  const [slpCompanyCustomerTypeId, slpAgencyCustomerTypeId] = await Promise.all([
    getCustomerTypeIdByCode("slp_company").catch(() => 0),
    getCustomerTypeIdByCode("slp_agency").catch(() => 0),
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
    slpCompanyCustomerTypeId,
    slpAgencyCustomerTypeId,
  };
}

/**
 * 特定の事業者レコードに紐づく接触履歴を取得（表示用に整形）
 */
export async function loadContactHistoriesForCompanyRecord(companyRecordId: number) {
  const rows = await prisma.slpContactHistory.findMany({
    where: { companyRecordId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatSlpContactHistory);
}

/**
 * 特定の代理店に紐づく接触履歴を取得（表示用に整形）
 */
export async function loadContactHistoriesForAgency(agencyId: number) {
  const rows = await prisma.slpContactHistory.findMany({
    where: { agencyId, deletedAt: null },
    include: contactHistoryIncludeForDisplay,
    orderBy: { contactDate: "desc" },
  });
  return rows.map(formatSlpContactHistory);
}
