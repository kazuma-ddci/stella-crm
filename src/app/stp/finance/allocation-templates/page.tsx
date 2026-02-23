import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllocationTemplatesTable } from "@/app/accounting/masters/allocation-templates/allocation-templates-table";
import { getSystemProjectContext, isTemplateContainingProject } from "@/lib/project-context";

export default async function StpAllocationTemplatesPage() {
  const [session, templates, allCostCenters, stpCtx] = await Promise.all([
    getSession(),
    prisma.allocationTemplate.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
      include: {
        lines: {
          include: {
            costCenter: { select: { id: true, name: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.costCenter.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        projectAssignments: { select: { projectId: true } },
      },
    }),
    getSystemProjectContext("stp"),
  ]);

  const isAdmin = session.permissions.some(
    (p) => p.permissionLevel === "admin"
  );

  // STP含有テンプレートのみフィルタ
  const stpTemplates = templates.filter((t) =>
    isTemplateContainingProject(t, stpCtx.costCenterIds)
  );

  const data = stpTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
    lineCount: t.lines.length,
    totalRate: t.lines
      .reduce((sum, l) => sum + Number(l.allocationRate), 0)
      .toFixed(2),
    lines: t.lines.map((l) => ({
      id: l.id,
      costCenterId: l.costCenterId ? String(l.costCenterId) : "",
      costCenterName: l.costCenter?.name ?? "未確定",
      allocationRate: Number(l.allocationRate),
      label: l.label ?? "",
    })),
  }));

  // CostCenterをSTPプロジェクトに属するもののみに絞り込み
  const costCenterOptions = allCostCenters
    .filter((cc) =>
      cc.projectAssignments.some((pa) => pa.projectId === stpCtx.projectId)
    )
    .map((cc) => ({
      value: String(cc.id),
      label: cc.name,
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">按分テンプレート（STP）</h1>
      <p className="text-sm text-muted-foreground">
        STPプロジェクトに関連する按分テンプレートを管理します。
      </p>
      <Card>
        <CardHeader>
          <CardTitle>テンプレート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationTemplatesTable
            data={data}
            costCenterOptions={costCenterOptions}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
