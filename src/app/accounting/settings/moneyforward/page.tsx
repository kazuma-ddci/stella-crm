import { getMoneyForwardConnections, getOperatingCompanies } from "./actions";
import { MFSettingsClient } from "./mf-settings-client";

export default async function MoneyForwardSettingsPage() {
  const [connections, companies] = await Promise.all([
    getMoneyForwardConnections(),
    getOperatingCompanies(),
  ]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">マネーフォワード連携設定</h1>
      <MFSettingsClient connections={connections} companies={companies} />
    </div>
  );
}
