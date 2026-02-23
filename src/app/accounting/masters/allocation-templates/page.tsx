import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AllocationTemplatesTable } from "./allocation-templates-table";

export default async function AllocationTemplatesPage() {
  const [templates, costCenters] = await Promise.all([
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
      select: { id: true, name: true },
    }),
  ]);

  const data = templates.map((t) => ({
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

  const costCenterOptions = costCenters.map((cc) => ({
    value: String(cc.id),
    label: cc.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">按分テンプレート</h1>
      <Card>
        <CardHeader>
          <CardTitle>テンプレート一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocationTemplatesTable
            data={data}
            costCenterOptions={costCenterOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
