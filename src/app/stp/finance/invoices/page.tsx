import { prisma } from "@/lib/prisma";
import { InvoicesTable } from "./invoices-table";

const formatDate = (date: Date | null | undefined) =>
  date ? date.toISOString().split("T")[0] : null;

export default async function InvoicesPage() {
  const [invoices, stpCompanies, agents] = await Promise.all([
    prisma.stpInvoice.findMany({
      where: { deletedAt: null },
      include: {
        stpCompany: { include: { company: true } },
        agent: { include: { company: true } },
        revenueRecords: {
          where: { deletedAt: null },
          select: { id: true, revenueType: true, expectedAmount: true, taxType: true, taxRate: true, taxAmount: true },
        },
        expenseRecords: {
          where: { deletedAt: null },
          select: { id: true, expenseType: true, expectedAmount: true, taxType: true, taxRate: true, taxAmount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stpCompany.findMany({
      include: { company: true },
    }),
    prisma.stpAgent.findMany({
      include: { company: true },
    }),
  ]);

  const stpCompanyOptions = stpCompanies.map((c) => ({
    value: String(c.id),
    label: c.company.name,
  }));

  const agentOptions = agents.map((a) => ({
    value: String(a.id),
    label: a.company.name,
  }));

  // 企業/代理店の支払い条件マップ（請求書日付自動設定用）
  const paymentTermsByStpCompany: Record<string, {
    closingDay: number | null;
    paymentMonthOffset: number | null;
    paymentDay: number | null;
  }> = {};
  stpCompanies.forEach((c) => {
    paymentTermsByStpCompany[String(c.id)] = {
      closingDay: c.company.closingDay,
      paymentMonthOffset: c.company.paymentMonthOffset,
      paymentDay: c.company.paymentDay,
    };
  });

  const paymentTermsByAgent: Record<string, {
    closingDay: number | null;
    paymentMonthOffset: number | null;
    paymentDay: number | null;
  }> = {};
  agents.forEach((a) => {
    paymentTermsByAgent[String(a.id)] = {
      closingDay: a.company.closingDay,
      paymentMonthOffset: a.company.paymentMonthOffset,
      paymentDay: a.company.paymentDay,
    };
  });

  const data = invoices.map((inv) => ({
    id: inv.id,
    direction: inv.direction,
    stpCompanyId: inv.stpCompanyId,
    stpCompanyDisplay: inv.stpCompany?.company.name || null,
    agentId: inv.agentId,
    agentDisplay: inv.agent?.company.name || null,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: formatDate(inv.invoiceDate),
    dueDate: formatDate(inv.dueDate),
    totalAmount: inv.totalAmount,
    taxAmount: inv.taxAmount,
    status: inv.status,
    // インボイス種別
    invoiceType: inv.invoiceType,
    originalInvoiceId: inv.originalInvoiceId,
    // 登録番号
    registrationNumber: inv.registrationNumber,
    // 税率ごと合計
    subtotalByTaxRate: inv.subtotalByTaxRate,
    filePath: inv.filePath,
    fileName: inv.fileName,
    note: inv.note,
    // 紐づくレコード情報
    revenueRecordCount: inv.revenueRecords.length,
    expenseRecordCount: inv.expenseRecords.length,
  }));

  // サマリー
  const outgoingCount = invoices.filter((i) => i.direction === "outgoing").length;
  const incomingCount = invoices.filter((i) => i.direction === "incoming").length;
  const outgoingTotal = invoices
    .filter((i) => i.direction === "outgoing")
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0);
  const incomingTotal = invoices
    .filter((i) => i.direction === "incoming")
    .reduce((sum, i) => sum + (i.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">請求書管理</h1>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">発行請求書</div>
          <div className="text-lg font-bold">{outgoingCount}件</div>
          <div className="text-sm text-muted-foreground">
            ¥{outgoingTotal.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">受領請求書</div>
          <div className="text-lg font-bold">{incomingCount}件</div>
          <div className="text-sm text-muted-foreground">
            ¥{incomingTotal.toLocaleString()}
          </div>
        </div>
      </div>

      <InvoicesTable
        data={data}
        stpCompanyOptions={stpCompanyOptions}
        agentOptions={agentOptions}
        paymentTermsByStpCompany={paymentTermsByStpCompany}
        paymentTermsByAgent={paymentTermsByAgent}
      />
    </div>
  );
}
