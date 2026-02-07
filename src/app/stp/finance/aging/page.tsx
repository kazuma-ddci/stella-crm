import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcTotalWithTax } from "@/lib/finance/auto-generate";

type AgingBucket = "not_due" | "within_30" | "days_31_60" | "days_61_90" | "over_90";

type CompanyAging = {
  companyName: string;
  not_due: number;
  within_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
  total: number;
};

function classifyAge(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "not_due";
  if (daysOverdue <= 30) return "within_30";
  if (daysOverdue <= 60) return "days_31_60";
  if (daysOverdue <= 90) return "days_61_90";
  return "over_90";
}

function daysBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default async function AgingPage() {
  const records = await prisma.stpRevenueRecord.findMany({
    where: {
      deletedAt: null,
      status: { in: ["pending", "approved", "invoiced", "overdue"] },
    },
    include: {
      stpCompany: { include: { company: true } },
    },
  });

  const today = new Date();

  // Calculate aging for each record
  const agingRecords = records.map((r) => {
    const referenceDate = r.dueDate || r.targetMonth;
    const daysOverdue = daysBetween(referenceDate, today);
    const bucket = classifyAge(daysOverdue);
    const amount = calcTotalWithTax(
      r.expectedAmount,
      r.taxType || "tax_included",
      r.taxRate ?? 10
    );

    return {
      companyName: r.stpCompany.company.name,
      bucket,
      amount,
    };
  });

  // Group by company
  const companyMap = new Map<string, CompanyAging>();

  for (const rec of agingRecords) {
    if (!companyMap.has(rec.companyName)) {
      companyMap.set(rec.companyName, {
        companyName: rec.companyName,
        not_due: 0,
        within_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        over_90: 0,
        total: 0,
      });
    }
    const entry = companyMap.get(rec.companyName)!;
    entry[rec.bucket] += rec.amount;
    entry.total += rec.amount;
  }

  const companies = Array.from(companyMap.values()).sort(
    (a, b) => b.total - a.total
  );

  // Summary totals
  const summary = {
    not_due: 0,
    within_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0,
    total: 0,
  };

  for (const c of companies) {
    summary.not_due += c.not_due;
    summary.within_30 += c.within_30;
    summary.days_31_60 += c.days_31_60;
    summary.days_61_90 += c.days_61_90;
    summary.over_90 += c.over_90;
    summary.total += c.total;
  }

  const bucketLabels: Record<AgingBucket, string> = {
    not_due: "未到来",
    within_30: "30日以内",
    days_31_60: "31-60日",
    days_61_90: "61-90日",
    over_90: "90日超",
  };

  const bucketColors: Record<AgingBucket, string> = {
    not_due: "text-gray-700",
    within_30: "text-gray-700",
    days_31_60: "text-yellow-700",
    days_61_90: "text-orange-700",
    over_90: "text-red-700",
  };

  const bucketBgColors: Record<AgingBucket, string> = {
    not_due: "",
    within_30: "",
    days_31_60: "bg-yellow-50",
    days_61_90: "bg-orange-50",
    over_90: "bg-red-50",
  };

  const summaryCards: { key: AgingBucket; label: string; color: string }[] = [
    { key: "not_due", label: "未到来", color: "text-gray-600" },
    { key: "within_30", label: "30日以内", color: "text-gray-600" },
    { key: "days_31_60", label: "31-60日", color: "text-yellow-600" },
    { key: "days_61_90", label: "61-90日", color: "text-orange-600" },
    { key: "over_90", label: "90日超", color: "text-red-600" },
  ];

  const recordCount = records.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">売掛金年齢表</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((card) => (
          <Card key={card.key}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">{card.label}</div>
              <div className={`text-xl font-bold ${card.color}`}>
                ¥{summary[card.key].toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              合計 ({recordCount}件)
            </div>
            <div className="text-xl font-bold">
              ¥{summary.total.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging table */}
      <Card>
        <CardHeader>
          <CardTitle>企業別売掛金年齢表</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              未入金の売上データがありません
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">企業名</th>
                    {(Object.keys(bucketLabels) as AgingBucket[]).map(
                      (bucket) => (
                        <th
                          key={bucket}
                          className={`text-right p-3 font-medium ${bucketColors[bucket]}`}
                        >
                          {bucketLabels[bucket]}
                        </th>
                      )
                    )}
                    <th className="text-right p-3 font-bold">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.companyName} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-medium">{company.companyName}</td>
                      {(Object.keys(bucketLabels) as AgingBucket[]).map(
                        (bucket) => (
                          <td
                            key={bucket}
                            className={`p-3 text-right ${
                              company[bucket] > 0
                                ? `font-medium ${bucketColors[bucket]} ${bucketBgColors[bucket]}`
                                : "text-muted-foreground"
                            }`}
                          >
                            {company[bucket] > 0
                              ? `¥${company[bucket].toLocaleString()}`
                              : "-"}
                          </td>
                        )
                      )}
                      <td className="p-3 text-right font-bold">
                        ¥{company.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="p-3">合計</td>
                    {(Object.keys(bucketLabels) as AgingBucket[]).map(
                      (bucket) => (
                        <td
                          key={bucket}
                          className={`p-3 text-right ${bucketColors[bucket]}`}
                        >
                          {summary[bucket] > 0
                            ? `¥${summary[bucket].toLocaleString()}`
                            : "-"}
                        </td>
                      )
                    )}
                    <td className="p-3 text-right">
                      ¥{summary.total.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
