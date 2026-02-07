import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AgentSummaryListPage() {
  const agents = await prisma.stpAgent.findMany({
    include: {
      company: true,
    },
    orderBy: { id: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">代理店別 経費サマリー</h1>
      <Card>
        <CardHeader>
          <CardTitle>代理店を選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">No.</th>
                  <th className="py-2 text-left font-medium">代理店名</th>
                  <th className="py-2 text-left font-medium">ステータス</th>
                  <th className="py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b hover:bg-muted/20">
                    <td className="py-2">{agent.id}</td>
                    <td className="py-2">{agent.company.name}</td>
                    <td className="py-2">{agent.status}</td>
                    <td className="py-2">
                      <Link
                        href={`/stp/finance/agent-summary/${agent.id}`}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        サマリーを表示
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {agents.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              代理店が登録されていません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
