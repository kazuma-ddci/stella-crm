import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CompanySummaryListPage() {
  const stpCompanies = await prisma.stpCompany.findMany({
    where: { company: { deletedAt: null } },
    include: {
      company: true,
    },
    orderBy: { id: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業別 収支サマリー</h1>
      <Card>
        <CardHeader>
          <CardTitle>企業を選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">No.</th>
                  <th className="py-2 text-left font-medium">企業名</th>
                  <th className="py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {stpCompanies.map((sc) => (
                  <tr key={sc.id} className="border-b hover:bg-muted/20">
                    <td className="py-2">{sc.id}</td>
                    <td className="py-2">{sc.company.name}</td>
                    <td className="py-2">
                      <Link
                        href={`/stp/finance/company-summary/${sc.id}`}
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
          {stpCompanies.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              STP企業が登録されていません
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
