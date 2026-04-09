import { prisma } from "@/lib/prisma";
import { CompanyRecordsTable } from "./company-records-table";

// JST(UTC+9)の日付・時刻文字列を返す
function toJstDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function toJstTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(11, 16);
}
function toJstDisplay(d: Date | null | undefined): string | null {
  const date = toJstDate(d);
  const time = toJstTime(d);
  if (!date) return null;
  return `${date} ${time ?? ""}`.trim();
}

export default async function SlpCompaniesPage() {
  // 一覧ページでは「パッと見る」のに必要な項目だけを取得する。
  // 詳細項目（金額・契約・住所・担当者一覧・提出書類など）は
  // /slp/companies/[id] の詳細ページで取得・表示する。
  const records = await prisma.slpCompanyRecord.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      briefingStatus: true,
      briefingDate: true,
      salesStaff: { select: { id: true, name: true } },
      status1: { select: { id: true, name: true } },
      status2: { select: { id: true, name: true } },
    },
    orderBy: { id: "asc" },
  });

  const data = records.map((r) => ({
    id: r.id,
    companyNo: r.id,
    companyName: r.companyName,
    briefingStatus: r.briefingStatus,
    briefingDate: toJstDisplay(r.briefingDate),
    salesStaffName: r.salesStaff?.name ?? null,
    status1Name: r.status1?.name ?? null,
    status2Name: r.status2?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業名簿</h1>
      <CompanyRecordsTable data={data} />
    </div>
  );
}
