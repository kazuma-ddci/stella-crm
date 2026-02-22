import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyContactsTable } from "./company-contacts-table";

export default async function CompanyContactsPage() {
  const STP_PROJECT_ID = 1; // 採用ブースト

  const [contacts, stpCompanies, contactMethods, customerTypes, allStaff, staffProjectAssignments, contactCategories] = await Promise.all([
    // 接触履歴（顧客種別「企業」のコンテキストを持つもの）
    prisma.contactHistory.findMany({
      where: {
        deletedAt: null,
        roles: {
          some: {
            customerType: {
              projectId: STP_PROJECT_ID,
              name: "企業",
            },
          },
        },
      },
      include: {
        company: true,
        contactMethod: true,
        contactCategory: true,
        roles: {
          include: {
            customerType: {
              include: {
                project: true,
              },
            },
          },
        },
        files: true,
      },
      orderBy: { contactDate: "desc" },
    }),
    prisma.stpCompany.findMany({
      include: {
        company: true,
      },
      orderBy: { company: { id: "desc" } },
    }),
    prisma.contactMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    // 全てのプロジェクト・顧客種別を取得
    prisma.customerType.findMany({
      where: { isActive: true },
      include: {
        project: true,
      },
      orderBy: [
        { project: { displayOrder: "asc" } },
        { displayOrder: "asc" },
      ],
    }),
    // 全スタッフを取得（表示用・不整合チェック用）
    prisma.masterStaff.findMany({
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    // スタッフのプロジェクト割当を取得
    prisma.staffProjectAssignment.findMany({
      include: {
        staff: true,
      },
    }),
    // 接触種別を取得
    prisma.contactCategory.findMany({
      where: { isActive: true },
      include: { project: true },
      orderBy: [
        { project: { displayOrder: "asc" } },
        { displayOrder: "asc" },
      ],
    }),
  ]);

  // companyIdからstpCompanyIdを取得するマップを作成
  const companyIdToStpCompanyId: Record<number, number> = {};
  stpCompanies.forEach((sc) => {
    companyIdToStpCompanyId[sc.companyId] = sc.id;
  });

  // スタッフIDから名前を取得するマップを作成（全スタッフ）
  const staffIdToName: Record<string, string> = {};
  allStaff.forEach((s) => {
    staffIdToName[String(s.id)] = s.name;
  });

  // プロジェクトIDごとのスタッフIDセットを作成
  const projectIdToStaffIds: Record<number, Set<string>> = {};
  staffProjectAssignments.forEach((spa) => {
    if (!projectIdToStaffIds[spa.projectId]) {
      projectIdToStaffIds[spa.projectId] = new Set();
    }
    projectIdToStaffIds[spa.projectId].add(String(spa.staffId));
  });

  // customerTypeIdからprojectIdを取得するマップ
  const customerTypeIdToProjectId: Record<number, number> = {};
  customerTypes.forEach((ct) => {
    customerTypeIdToProjectId[ct.id] = ct.projectId;
  });

  // スタッフIDのカンマ区切り文字列からスタッフ名のカンマ区切り文字列に変換
  const getStaffNames = (assignedTo: string | null): string => {
    if (!assignedTo) return "";
    const ids = assignedTo.split(",").filter(Boolean);
    const names = ids.map((id) => staffIdToName[id] || id);
    return names.join(", ");
  };

  // 担当者とプロジェクトの不整合をチェック
  const checkStaffMismatch = (assignedTo: string | null, customerTypeIds: number[]): string[] => {
    if (!assignedTo) return [];
    const staffIds = assignedTo.split(",").filter(Boolean);

    // 選択されたcustomerTypeIdsからprojectIdを取得
    const projectIds = new Set<number>();
    customerTypeIds.forEach((ctId) => {
      const projectId = customerTypeIdToProjectId[ctId];
      if (projectId) {
        projectIds.add(projectId);
      }
    });

    // 各担当者がいずれかのプロジェクトに紐づいているかチェック
    const mismatchedStaff: string[] = [];
    staffIds.forEach((staffId) => {
      let hasMatch = false;
      projectIds.forEach((projectId) => {
        if (projectIdToStaffIds[projectId]?.has(staffId)) {
          hasMatch = true;
        }
      });
      if (!hasMatch) {
        const staffName = staffIdToName[staffId] || staffId;
        mismatchedStaff.push(staffName);
      }
    });

    return mismatchedStaff;
  };

  const data = contacts.map((c) => {
    const customerTypeIds = c.roles.map((r) => r.customerTypeId);
    const mismatchedStaff = checkStaffMismatch(c.assignedTo, customerTypeIds);

    return {
      id: c.id,
      stpCompanyId: companyIdToStpCompanyId[c.companyId] || null,
      companyCode: c.company.companyCode,
      companyName: c.company.name,
      contactDate: c.contactDate.toISOString(),
      contactMethodId: c.contactMethodId,
      contactMethodName: c.contactMethod?.name,
      contactCategoryId: c.contactCategoryId,
      contactCategoryName: c.contactCategory?.name,
      assignedTo: c.assignedTo,
      staffName: getStaffNames(c.assignedTo),
      hasMismatch: mismatchedStaff.length > 0,
      mismatchedStaff: mismatchedStaff.join(", "),
      customerParticipants: c.customerParticipants,
      meetingMinutes: c.meetingMinutes,
      note: c.note,
      // 紐付けられている顧客種別ID（複数可能）
      customerTypeIds,
      // 表示用: プロジェクト名:顧客種別名
      customerTypeLabels: c.roles.map((r) =>
        `${r.customerType.project.name}:${r.customerType.name}`
      ).join(", "),
      // 添付ファイル
      files: c.files.map((f) => ({
        id: f.id,
        filePath: f.filePath,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
      })),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  });

  const stpCompanyOptions = stpCompanies.map((c) => ({
    value: String(c.id),
    label: c.company.name,
  }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  // 顧客種別の選択肢（プロジェクト名:顧客種別名の形式）
  const customerTypeOptions = customerTypes.map((ct) => ({
    value: String(ct.id),
    label: `${ct.project.name}:${ct.name}`,
  }));

  // 全スタッフの選択肢（選択用）
  const staffOptions = allStaff.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // プロジェクトごとのスタッフ選択肢
  const staffByProject: Record<number, { value: string; label: string }[]> = {};
  staffProjectAssignments.forEach((spa) => {
    if (!staffByProject[spa.projectId]) {
      staffByProject[spa.projectId] = [];
    }
    // 重複チェック
    if (!staffByProject[spa.projectId].find((s) => s.value === String(spa.staffId))) {
      staffByProject[spa.projectId].push({
        value: String(spa.staffId),
        label: spa.staff.name,
      });
    }
  });

  // customerTypeIdとprojectIdのマッピング（クライアント側で使用）
  const customerTypeProjectMap: Record<string, number> = {};
  customerTypes.forEach((ct) => {
    customerTypeProjectMap[String(ct.id)] = ct.projectId;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業接触履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyContactsTable
            data={data}
            stpCompanyOptions={stpCompanyOptions}
            contactMethodOptions={contactMethodOptions}
            customerTypeOptions={customerTypeOptions}
            staffOptions={staffOptions}
            staffByProject={staffByProject}
            customerTypeProjectMap={customerTypeProjectMap}
            contactCategories={contactCategories.map((cc) => ({
              id: cc.id,
              name: cc.name,
              projectId: cc.projectId,
              project: { id: cc.project.id, name: cc.project.name, displayOrder: cc.project.displayOrder },
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
