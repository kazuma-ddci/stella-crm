import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CounterpartiesTable } from "./counterparties-table";
import { StellaCompaniesTable } from "./stella-companies-table";
import { getStellaCompaniesForAccounting } from "./actions";

export default async function CounterpartiesPage() {
  const [counterparties, stellaCompanies] = await Promise.all([
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, companyId: null, costCenterId: null },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    getStellaCompaniesForAccounting(),
  ]);

  const counterpartyData = counterparties.map((cp) => ({
    id: cp.id,
    displayId: cp.displayId ?? "",
    name: cp.name,
    counterpartyType: cp.counterpartyType,
    memo: cp.memo ?? "",
    isActive: cp.isActive,
    isInvoiceRegistered: cp.isInvoiceRegistered,
    invoiceRegistrationNumber: cp.invoiceRegistrationNumber ?? "",
    invoiceEffectiveDate: cp.invoiceEffectiveDate
      ? new Date(cp.invoiceEffectiveDate).toISOString().split("T")[0]
      : "",
  }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">取引先管理</h1>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="stella">
            <TabsList>
              <TabsTrigger value="stella">
                全顧客マスタ（{stellaCompanies.length}）
              </TabsTrigger>
              <TabsTrigger value="other">
                その他取引先（{counterpartyData.length}）
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stella" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                CRM全体の顧客マスタです。インボイス登録情報と銀行口座を確認・編集できます。
              </p>
              <StellaCompaniesTable data={stellaCompanies} />
            </TabsContent>

            <TabsContent value="other" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                顧客マスタに含まれない取引先（サービス提供元、個人事業主等）を管理します。
              </p>
              <CounterpartiesTable data={counterpartyData} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
