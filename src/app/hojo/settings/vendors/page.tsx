import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorsTable } from "./vendors-table";
import { FormResponsesTable } from "./form-responses-table";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";

export default async function VendorsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  // hojoプロジェクトのedit/manager権限を持つスタッフを取得
  const hojoProject = await prisma.masterProject.findFirst({ where: { code: "hojo" } });
  const staffWithHojoPermission = hojoProject
    ? await prisma.masterStaff.findMany({
        where: {
          isActive: true,
          isSystemUser: false,
          permissions: { some: { projectId: hojoProject.id, permissionLevel: { in: ["edit", "manager"] } } },
        },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const staffOptions = staffWithHojoPermission.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const [
    vendors,
    scLineFriends,
    scWholesaleStatuses,
    consultingPlanStatuses,
    contractStatuses,
    vendorRegistrationStatuses,
    toolRegistrationStatuses,
  ] = await Promise.all([
    prisma.hojoVendor.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        consultingStaff: {
          include: { staff: { select: { id: true, name: true } } },
        },
        assignedAsLineFriend: {
          select: { id: true, sei: true, mei: true, snsname: true },
        },
        scWholesaleStatus: { select: { id: true, name: true } },
        scWholesaleContractStatus: { select: { id: true, name: true } },
        consultingPlanStatus: { select: { id: true, name: true } },
        consultingPlanContractStatus: { select: { id: true, name: true } },
        grantApplicationBpoContractStatus: { select: { id: true, name: true } },
        vendorRegistrationStatus: { select: { id: true, name: true } },
        toolRegistrationStatus: { select: { id: true, name: true } },
        contacts: {
          include: {
            lineFriend: { select: { id: true, uid: true, free1: true, snsname: true } },
          },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    }),
    prisma.hojoLineFriendSecurityCloud.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, uid: true, sei: true, mei: true, snsname: true, userType: true, free1: true },
    }),
    prisma.hojoVendorScWholesaleStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.hojoVendorConsultingPlanStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.hojoVendorContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.hojoVendorRegistrationStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.hojoVendorToolRegistrationStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // セキュリティクラウドLINEからASユーザーを検出するためのマップ
  const scByUid = new Map(scLineFriends.map((f) => [f.uid, f]));

  // 担当AS表示用ラベル整形（姓名が空の場合は括弧自体を省略）
  const formatAsLabel = (f: { id: number | bigint; snsname: string | null; sei: string | null; mei: string | null }) => {
    const sei = f.sei?.trim() ?? "";
    const mei = f.mei?.trim() ?? "";
    let namePart = "";
    if (sei && mei) namePart = `(${sei} ${mei})`;
    else if (sei) namePart = `(${sei})`;
    else if (mei) namePart = `(${mei})`;
    return `${f.id} ${f.snsname || ""}${namePart}`.trim();
  };

  // 担当AS selectオプション（ASタイプのLINE友達）
  const asLineFriends = scLineFriends.filter((f) => f.userType === "AS");
  const scLineFriendOptions = asLineFriends.map((f) => ({
    value: String(f.id),
    label: formatAsLabel(f),
  }));

  const data = vendors.map((v) => {
    // コンサル担当者
    const consultingStaffNames = v.consultingStaff.map((cs) => cs.staff.name);
    const consultingStaffIds = v.consultingStaff.map((cs) => String(cs.staff.id));

    // 担当AS: 手動設定 or 自動検出
    let assignedAsDisplay = "-";
    if (v.assignedAsLineFriendId && v.assignedAsLineFriend) {
      assignedAsDisplay = formatAsLabel(v.assignedAsLineFriend);
    } else {
      // 自動検出: vendorのcontactのlineFriend.free1 → セキュリティクラウドLINEのuid → userType=AS
      for (const c of v.contacts) {
        if (c.lineFriend?.free1) {
          const asFriend = scByUid.get(c.lineFriend.free1);
          if (asFriend && asFriend.userType === "AS") {
            assignedAsDisplay = formatAsLabel(asFriend);
            break;
          }
        }
      }
    }

    return {
      id: v.id,
      name: v.name,
      accessToken: v.accessToken,
      consultingStaffDisplay: consultingStaffNames.join(", ") || "-",
      consultingStaffIds: consultingStaffIds.join(","),
      assignedAsDisplay,
      assignedAsLineFriendId: v.assignedAsLineFriendId ? String(v.assignedAsLineFriendId) : "",
      // 絞り込み用フィールド
      scWholesaleStatusName: v.scWholesaleStatus?.name ?? "",
      scWholesaleContractStatusName: v.scWholesaleContractStatus?.name ?? "",
      consultingPlanStatusName: v.consultingPlanStatus?.name ?? "",
      consultingPlanContractStatusName: v.consultingPlanContractStatus?.name ?? "",
      grantApplicationBpo: v.grantApplicationBpo,
      grantApplicationBpoContractStatusName: v.grantApplicationBpoContractStatus?.name ?? "",
      loanUsage: v.loanUsage,
      subsidyConsulting: v.subsidyConsulting,
      vendorRegistrationStatusName: v.vendorRegistrationStatus?.name ?? "",
      toolRegistrationStatusName: v.toolRegistrationStatus?.name ?? "",
      memo: v.memo ?? "",
      displayOrder: v.displayOrder,
      isActive: v.isActive,
    };
  });

  const scWholesaleStatusOptions = scWholesaleStatuses.map((s) => ({
    value: s.name,
    label: s.name,
  }));
  const consultingPlanStatusOptions = consultingPlanStatuses.map((s) => ({
    value: s.name,
    label: s.name,
  }));
  const contractStatusOptions = contractStatuses.map((s) => ({
    value: s.name,
    label: s.name,
  }));
  const vendorRegistrationStatusOptions = vendorRegistrationStatuses.map((s) => ({
    value: s.name,
    label: s.name,
  }));
  const toolRegistrationStatusOptions = toolRegistrationStatuses.map((s) => ({
    value: s.name,
    label: s.name,
  }));

  // フォーム回答データ取得
  const formResponses = await prisma.hojoFormSubmission.findMany({
    where: { formType: "contract-confirmation", deletedAt: null },
    orderBy: { submittedAt: "desc" },
  });

  const formResponseData = formResponses.map((r) => ({
    id: r.id,
    companyName: r.companyName,
    representName: r.representName,
    email: r.email,
    phone: r.phone,
    submittedAt: r.submittedAt.toISOString(),
    answers: (r.answers as Record<string, string>) ?? {},
    staffMemo: r.staffMemo,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ベンダー</h1>
      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">ベンダー一覧</TabsTrigger>
          <TabsTrigger value="form-responses">
            フォーム回答
            {formResponseData.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                {formResponseData.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle>ベンダー一覧</CardTitle>
            </CardHeader>
            <CardContent>
              <VendorsTable
                data={data}
                canEdit={canEdit}
                staffOptions={staffOptions}
                scLineFriendOptions={scLineFriendOptions}
                scWholesaleStatusOptions={scWholesaleStatusOptions}
                consultingPlanStatusOptions={consultingPlanStatusOptions}
                contractStatusOptions={contractStatusOptions}
                vendorRegistrationStatusOptions={vendorRegistrationStatusOptions}
                toolRegistrationStatusOptions={toolRegistrationStatusOptions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form-responses">
          <Card>
            <CardHeader>
              <CardTitle>契約内容確認フォーム回答</CardTitle>
            </CardHeader>
            <CardContent>
              <FormResponsesTable data={formResponseData} canEdit={canEdit} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
