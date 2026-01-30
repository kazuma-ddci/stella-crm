import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentContactsTable } from "./agent-contacts-table";

export default async function AgentContactsPage() {
  const [contacts, agents, contactMethods] = await Promise.all([
    prisma.stpContactHistory.findMany({
      where: {
        agentId: { not: null },
      },
      include: {
        agent: true,
        contactMethod: true,
      },
      orderBy: { contactDate: "desc" },
    }),
    prisma.stpAgent.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.stpContactMethod.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const data = contacts.map((c) => ({
    id: c.id,
    agentId: c.agentId,
    agentName: c.agent?.name,
    contactDate: c.contactDate.toISOString(),
    contactMethodId: c.contactMethodId,
    contactMethodName: c.contactMethod?.name,
    assignedTo: c.assignedTo,
    meetingMinutes: c.meetingMinutes,
    note: c.note,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const agentOptions = agents.map((a) => ({
    value: String(a.id),
    label: a.name,
  }));

  const contactMethodOptions = contactMethods.map((m) => ({
    value: String(m.id),
    label: m.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">代理店接触履歴</h1>
      <Card>
        <CardHeader>
          <CardTitle>接触履歴一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentContactsTable
            data={data}
            agentOptions={agentOptions}
            contactMethodOptions={contactMethodOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
