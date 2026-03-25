import { getAlerts } from "./actions";
import { AlertsClient } from "./alerts-client";

export default async function AlertsPage() {
  const alerts = await getAlerts();
  return <AlertsClient alerts={alerts} />;
}
