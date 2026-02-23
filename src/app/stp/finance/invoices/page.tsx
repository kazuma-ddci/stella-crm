import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceGroupsTable } from "./invoice-groups-table";
import { getInvoiceGroups } from "./actions";

export default async function InvoiceGroupsPage() {
  const [data, counterparties, operatingCompanies] = await Promise.all([
    getInvoiceGroups(),
    prisma.counterparty.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.operatingCompany.findMany({
      where: { isActive: true },
      include: { bankAccounts: { where: { deletedAt: null } } },
      orderBy: { id: "asc" },
    }),
  ]);

  const counterpartyOptions = counterparties.map((c) => ({
    value: String(c.id),
    label: c.name,
  }));

  const operatingCompanyOptions = operatingCompanies.map((c) => ({
    value: String(c.id),
    label: c.companyName,
  }));

  // 運営法人IDごとの銀行口座マップ
  const bankAccountsByCompany: Record<
    string,
    { value: string; label: string }[]
  > = {};
  for (const company of operatingCompanies) {
    bankAccountsByCompany[String(company.id)] = company.bankAccounts.map(
      (ba) => ({
        value: String(ba.id),
        label: `${ba.bankName} ${ba.branchName} ${ba.accountNumber}`,
      })
    );
  }

  // サマリー
  const totalCount = data.length;
  const draftCount = data.filter((r) => r.status === "draft").length;
  const totalAmount = data
    .filter((r) => r.status !== "corrected")
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
  const unpaidAmount = data
    .filter((r) =>
      ["sent", "awaiting_accounting", "partially_paid"].includes(r.status)
    )
    .reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">請求グループ管理</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">総件数</div>
            <div className="text-2xl font-bold">{totalCount}件</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">下書き</div>
            <div className="text-2xl font-bold text-orange-600">
              {draftCount}件
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">請求合計</div>
            <div className="text-2xl font-bold text-emerald-600">
              ¥{totalAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">未入金</div>
            <div className="text-2xl font-bold text-rose-600">
              ¥{unpaidAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <InvoiceGroupsTable
        data={data}
        counterpartyOptions={counterpartyOptions}
        operatingCompanyOptions={operatingCompanyOptions}
        bankAccountsByCompany={bankAccountsByCompany}
      />
    </div>
  );
}
