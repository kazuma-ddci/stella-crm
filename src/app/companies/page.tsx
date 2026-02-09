import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompaniesTable } from "./companies-table";

export default async function CompaniesPage() {
  // AS種別のスタッフを取得
  const asRoleType = await prisma.staffRoleType.findFirst({
    where: { code: "AS" },
  });

  const asStaff = asRoleType
    ? await prisma.masterStaff.findMany({
        where: {
          isActive: true,
          isSystemUser: false,
          roleAssignments: {
            some: { roleTypeId: asRoleType.id },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const staffOptions = asStaff.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const companies = await prisma.masterStellaCompany.findMany({
    where: { mergedIntoId: null },
    orderBy: { id: "asc" },
    include: {
      staff: true,
      locations: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
      bankAccounts: {
        where: { deletedAt: null },
        orderBy: { id: "asc" },
      },
    },
  });

  const data = companies.map((c) => ({
    id: c.id,
    companyCode: c.companyCode,
    name: c.name,
    nameKana: c.nameKana,
    corporateNumber: c.corporateNumber,
    companyType: c.companyType,
    staffId: c.staffId,
    leadSource: c.leadSource,
    websiteUrl: c.websiteUrl,
    industry: c.industry,
    revenueScale: c.revenueScale,
    note: c.note,
    // 支払い条件
    closingDay: c.closingDay,
    paymentMonthOffset: c.paymentMonthOffset,
    paymentDay: c.paymentDay,
    // 拠点情報（モーダル用 + 表示用）
    locations: c.locations.map((location) => ({
      id: location.id,
      companyId: location.companyId,
      name: location.name,
      address: location.address,
      phone: location.phone,
      email: location.email,
      isPrimary: location.isPrimary,
      note: location.note,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    })),
    // 企業担当者情報（モーダル用 + 表示用）
    contacts: c.contacts.map((contact) => ({
      id: contact.id,
      companyId: contact.companyId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      department: contact.department,
      isPrimary: contact.isPrimary,
      note: contact.note,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    })),
    // 銀行口座情報（モーダル用 + 表示用）
    bankAccounts: c.bankAccounts.map((ba) => ({
      id: ba.id,
      companyId: ba.companyId,
      bankName: ba.bankName,
      bankCode: ba.bankCode,
      branchName: ba.branchName,
      branchCode: ba.branchCode,
      accountNumber: ba.accountNumber,
      accountHolderName: ba.accountHolderName,
      note: ba.note,
      createdAt: ba.createdAt.toISOString(),
      updatedAt: ba.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Stella全顧客マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>顧客一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CompaniesTable data={data} staffOptions={staffOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
