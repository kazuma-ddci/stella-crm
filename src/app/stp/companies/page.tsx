import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StpCompaniesTable } from "./stp-companies-table";

export default async function StpCompaniesPage() {
  const [companies, masterCompanies, stages, agents] = await Promise.all([
    prisma.stpCompany.findMany({
      include: {
        company: true,
        currentStage: true,
        nextTargetStage: true,
        agent: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.masterStellaCompany.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.stpStage.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.stpAgent.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const data = companies.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    companyName: c.company.name,
    note: c.note,
    leadAcquiredDate: c.leadAcquiredDate?.toISOString(),
    meetingDate: c.meetingDate?.toISOString(),
    currentStageId: c.currentStageId,
    currentStageName: c.currentStage?.name,
    nextTargetStageId: c.nextTargetStageId,
    nextTargetStageName: c.nextTargetStage?.name,
    nextTargetDate: c.nextTargetDate?.toISOString(),
    agentId: c.agentId,
    agentName: c.agent?.name,
    assignedTo: c.assignedTo,
    priority: c.priority,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const companyOptions = masterCompanies.map((c) => ({
    value: String(c.id),
    label: `${c.companyCode} - ${c.name}`,
  }));

  const stageOptions = stages.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const agentOptions = agents.map((a) => ({
    value: String(a.id),
    label: a.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 企業情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>企業一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <StpCompaniesTable
            data={data}
            companyOptions={companyOptions}
            stageOptions={stageOptions}
            agentOptions={agentOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
