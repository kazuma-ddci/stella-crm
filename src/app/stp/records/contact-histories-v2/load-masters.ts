import { prisma } from "@/lib/prisma";

/**
 * STP 新接触履歴 (V2) 用のマスタデータ一式を取得する。
 * 作成/編集フォームで使う: 接触方法・接触種別・スタッフ・顧客側選択肢。
 *
 * STP の顧客側 targetType:
 *   stp_company (MasterStellaCompany から選択)
 *   stp_agent   (StpAgent から選択、表示は紐づく MasterStellaCompany.name)
 *   stp_other   (targetId 不要)
 */
export async function loadStpContactHistoryV2Masters() {
  const stpProject = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  if (!stpProject) {
    return null;
  }
  const STP_PROJECT_ID = stpProject.id;

  const [contactMethods, contactCategories, staffAssignments, companies, agents] =
    await Promise.all([
      prisma.contactMethod.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.contactCategory.findMany({
        where: { isActive: true, projectId: STP_PROJECT_ID },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.staffProjectAssignment.findMany({
        where: { projectId: STP_PROJECT_ID },
        select: {
          staff: { select: { id: true, name: true, isActive: true, isSystemUser: true } },
        },
      }),
      prisma.masterStellaCompany.findMany({
        where: { deletedAt: null, mergedIntoId: null },
        orderBy: { id: "asc" },
        select: { id: true, name: true, companyCode: true },
      }),
      prisma.stpAgent.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          status: true,
          company: { select: { id: true, name: true } },
        },
      }),
    ]);

  const staffOptions = staffAssignments
    .map((a) => a.staff)
    .filter((s) => s.isActive && !s.isSystemUser)
    .map((s) => ({ value: String(s.id), label: s.name }));

  return {
    projectId: STP_PROJECT_ID,
    contactMethods: contactMethods.map((m) => ({ value: String(m.id), label: m.name })),
    contactCategories: contactCategories.map((c) => ({ value: String(c.id), label: c.name })),
    staffOptions,
    companies: companies.map((c) => ({
      value: String(c.id),
      label: `${c.name}${c.companyCode ? ` (${c.companyCode})` : ""}`,
    })),
    agents: agents
      .filter((a) => a.status !== "解約")
      .map((a) => ({
        value: String(a.id),
        label: `${a.company.name}${a.status === "非アクティブ" ? " (非アクティブ)" : ""}`,
      })),
  };
}

export type StpContactHistoryV2Masters = NonNullable<
  Awaited<ReturnType<typeof loadStpContactHistoryV2Masters>>
>;
