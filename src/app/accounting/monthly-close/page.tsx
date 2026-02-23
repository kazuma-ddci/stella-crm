import { getMonthlyCloseData } from "./actions";
import { MonthlyCloseClient } from "./monthly-close-client";

export default async function AccountingMonthlyClosePage() {
  // 過去12ヶ月（今月 + 11ヶ月前）
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }

  const { statuses, history } = await getMonthlyCloseData(months);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">月次クローズ</h1>
      <MonthlyCloseClient statuses={statuses} history={history} />
    </div>
  );
}
