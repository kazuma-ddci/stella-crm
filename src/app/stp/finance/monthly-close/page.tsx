import { getMonthlyCloseView } from "./actions";
import { MonthlyCloseControls } from "./monthly-close-controls";

export default async function MonthlyClosePage() {
  // 過去12ヶ月（今月 + 11ヶ月前）
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }

  const { statuses, history } = await getMonthlyCloseView(months);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">月次クローズ状況</h1>
        <p className="text-sm text-muted-foreground mt-1">
          月次クローズ・再オープンは経理管理者が実行します
        </p>
      </div>
      <MonthlyCloseControls statuses={statuses} history={history} />
    </div>
  );
}
