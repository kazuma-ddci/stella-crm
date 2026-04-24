import { prisma } from "@/lib/prisma";

/**
 * SLP 新接触履歴 (V2) 用のマスタデータ一式を取得する。
 * 作成/編集フォームで使う: 接触方法・接触種別・スタッフ・顧客側選択肢。
 */
export async function loadSlpContactHistoryV2Masters() {
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  if (!slpProject) {
    return null;
  }
  const SLP_PROJECT_ID = slpProject.id;

  const [
    contactMethods,
    contactCategories,
    slpStaffAssignments,
    allStaff,
    companyRecords,
    agencies,
    lineFriends,
  ] = await Promise.all([
    prisma.contactMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.contactCategory.findMany({
      where: { isActive: true, projectId: SLP_PROJECT_ID },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.staffProjectAssignment.findMany({
      where: { projectId: SLP_PROJECT_ID },
      select: { staffId: true },
    }),
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.slpCompanyRecord.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.slpAgency.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    }),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, snsname: true },
    }),
  ]);

  // プロジェクトに紐づくスタッフ ID セット (優先表示グループ)
  const slpStaffIdSet = new Set<number>(slpStaffAssignments.map((a) => a.staffId));

  // 全スタッフを「SLP所属」と「その他」に分割
  const projectStaffOptions = allStaff
    .filter((s) => slpStaffIdSet.has(s.id))
    .map((s) => ({ value: String(s.id), label: s.name }));
  const otherStaffOptions = allStaff
    .filter((s) => !slpStaffIdSet.has(s.id))
    .map((s) => ({ value: String(s.id), label: s.name }));

  return {
    projectId: SLP_PROJECT_ID,
    contactMethods: contactMethods.map((m) => ({ value: String(m.id), label: m.name })),
    contactCategories: contactCategories.map((c) => ({ value: String(c.id), label: c.name })),
    projectStaffOptions,
    otherStaffOptions,
    companyRecords: companyRecords.map((c) => ({
      value: String(c.id),
      label: c.companyName ?? `事業者#${c.id}`,
    })),
    agencies: agencies.map((a) => ({
      value: String(a.id),
      label: a.name ?? `代理店#${a.id}`,
    })),
    lineFriends: lineFriends.map((lf) => ({
      value: String(lf.id),
      label: `${lf.id} ${lf.snsname ?? ""}`.trim(),
    })),
  };
}

export type SlpContactHistoryV2Masters = NonNullable<
  Awaited<ReturnType<typeof loadSlpContactHistoryV2Masters>>
>;
