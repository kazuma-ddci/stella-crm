import { prisma } from "@/lib/prisma";

/**
 * HOJO 新接触履歴 (V2) 用のマスタデータ一式を取得する。
 * 作成/編集フォームで使う: 接触方法・接触種別・スタッフ・顧客側選択肢(ベンダーのみ)。
 *
 * HOJO の顧客側 targetType:
 *   hojo_vendor (HojoVendor から選択)
 *   hojo_bbs / hojo_lender / hojo_other (いずれも targetId 不要)
 */
export async function loadHojoContactHistoryV2Masters() {
  const hojoProject = await prisma.masterProject.findFirst({
    where: { code: "hojo" },
    select: { id: true },
  });
  if (!hojoProject) {
    return null;
  }
  const HOJO_PROJECT_ID = hojoProject.id;

  const [contactMethods, contactCategories, hojoStaffAssignments, allStaff, vendors] =
    await Promise.all([
      prisma.contactMethod.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.contactCategory.findMany({
        where: { isActive: true, projectId: HOJO_PROJECT_ID },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.staffProjectAssignment.findMany({
        where: { projectId: HOJO_PROJECT_ID },
        select: { staffId: true },
      }),
      prisma.masterStaff.findMany({
        where: { isActive: true, isSystemUser: false },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.hojoVendor.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
    ]);

  const hojoStaffIdSet = new Set<number>(hojoStaffAssignments.map((a) => a.staffId));
  const projectStaffOptions = allStaff
    .filter((s) => hojoStaffIdSet.has(s.id))
    .map((s) => ({ value: String(s.id), label: s.name }));
  const otherStaffOptions = allStaff
    .filter((s) => !hojoStaffIdSet.has(s.id))
    .map((s) => ({ value: String(s.id), label: s.name }));

  return {
    projectId: HOJO_PROJECT_ID,
    contactMethods: contactMethods.map((m) => ({ value: String(m.id), label: m.name })),
    contactCategories: contactCategories.map((c) => ({ value: String(c.id), label: c.name })),
    projectStaffOptions,
    otherStaffOptions,
    vendors: vendors.map((v) => ({
      value: String(v.id),
      label: v.name ?? `ベンダー#${v.id}`,
    })),
  };
}

export type HojoContactHistoryV2Masters = NonNullable<
  Awaited<ReturnType<typeof loadHojoContactHistoryV2Masters>>
>;
