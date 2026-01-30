import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentsTable } from "./agents-table";

export default async function StpAgentsPage() {
  const agents = await prisma.stpAgent.findMany({
    orderBy: { id: "asc" },
  });

  const data = agents.map((a) => ({
    id: a.id,
    agentCode: a.agentCode,
    name: a.name,
    contactPerson: a.contactPerson,
    email: a.email,
    phone: a.phone,
    note: a.note,
    isActive: a.isActive,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 代理店情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>代理店一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentsTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}
