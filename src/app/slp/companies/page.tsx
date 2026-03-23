import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlpCompaniesTable } from "./slp-companies-table";
import { getStaffOptionsByFields } from "@/lib/staff/get-staff-by-field";

export default async function SlpCompaniesPage() {
  const [companies, masterCompanies] = await Promise.all([
    prisma.slpCompany.findMany({
      include: {
        company: true,
        consultantStaff: true,
        csStaff: true,
        agentCompany: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.masterStellaCompany.findMany({
      where: { deletedAt: null, mergedIntoId: null },
      orderBy: { id: "desc" },
    }),
  ]);

  const staffOptionsByFieldResult = await getStaffOptionsByFields([
    "SLP_COMPANY_CONSULTANT",
    "SLP_COMPANY_CS",
  ]);
  const consultantStaffOptions = staffOptionsByFieldResult.SLP_COMPANY_CONSULTANT;
  const csStaffOptions = staffOptionsByFieldResult.SLP_COMPANY_CS;

  const data = companies.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    companyCode: c.company.companyCode,
    companyName: c.company.name,
    corporateNumber: c.company.corporateNumber,
    industry: c.company.industry,
    employeeCount: c.company.employeeCount,
    revenueScale: c.company.revenueScale,
    annualLaborCost: c.annualLaborCost,
    targetEmployeeCount: c.targetEmployeeCount,
    targetEstimateRate: c.targetEstimateRate ? Number(c.targetEstimateRate) : null,
    consultantStaffId: c.consultantStaffId,
    consultantStaffName: c.consultantStaff?.name || null,
    csStaffId: c.csStaffId,
    csStaffName: c.csStaff?.name || null,
    agentCompanyId: c.agentCompanyId,
    agentCompanyName: c.agentCompany?.name || null,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const companyOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
  }));

  const agentCompanyOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} ${c.name}`,
  }));

  // 企業ID → 全顧客マスタデータのマップ（新規追加時のプリフィル用）
  const companyDataMap: Record<string, { corporateNumber: string | null; industry: string | null; employeeCount: number | null; revenueScale: string | null }> = {};
  masterCompanies.forEach((c) => {
    companyDataMap[String(c.id)] = {
      corporateNumber: c.corporateNumber,
      industry: c.industry,
      employeeCount: c.employeeCount,
      revenueScale: c.revenueScale,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">SLP 案件管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>案件一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <SlpCompaniesTable
            data={data}
            companyOptions={companyOptions}
            consultantStaffOptions={consultantStaffOptions}
            csStaffOptions={csStaffOptions}
            agentCompanyOptions={agentCompanyOptions}
            companyDataMap={companyDataMap}
          />
        </CardContent>
      </Card>
    </div>
  );
}
