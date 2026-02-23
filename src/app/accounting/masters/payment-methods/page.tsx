import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentMethodsTable } from "./payment-methods-table";

export default async function PaymentMethodsPage() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { deletedAt: null },
    orderBy: [{ id: "asc" }],
    include: {
      settlementAccount: { select: { id: true, name: true } },
    },
  });

  // クレカの引落口座選択肢（銀行口座のみ）
  const settlementAccountOptions = paymentMethods
    .filter((pm) => pm.methodType === "bank_account" && pm.isActive)
    .map((ba) => ({
      value: String(ba.id),
      label: ba.name,
    }));

  const data = paymentMethods.map((pm) => {
    const details = (pm.details as Record<string, unknown>) || {};
    return {
      id: pm.id,
      methodType: pm.methodType,
      name: pm.name,
      // 銀行口座の詳細
      bankName: (details.bankName as string) || "",
      branchName: (details.branchName as string) || "",
      accountType: (details.accountType as string) || "",
      accountNumber: (details.accountNumber as string) || "",
      accountHolder: (details.accountHolder as string) || "",
      // クレジットカードの詳細
      cardBrand: (details.cardBrand as string) || "",
      cardLast4: (details.cardLast4 as string) || "",
      closingDay: pm.closingDay,
      paymentDay: pm.paymentDay,
      settlementAccountId: pm.settlementAccountId
        ? String(pm.settlementAccountId)
        : "",
      settlementAccountLabel: pm.settlementAccount?.name || "",
      // 仮想通貨ウォレットの詳細
      cryptoCurrency: (details.currency as string) || "",
      cryptoNetwork: (details.network as string) || "",
      walletAddress: (details.walletAddress as string) || "",
      // 共通フィールド
      initialBalance: pm.initialBalance,
      initialBalanceDate: pm.initialBalanceDate
        ? pm.initialBalanceDate.toISOString().split("T")[0]
        : "",
      balanceAlertThreshold: pm.balanceAlertThreshold,
      isActive: pm.isActive,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">決済手段マスタ</h1>
      <Card>
        <CardHeader>
          <CardTitle>決済手段一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodsTable
            data={data}
            settlementAccountOptions={settlementAccountOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
