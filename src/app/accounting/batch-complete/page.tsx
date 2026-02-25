import { getAwaitingAccountingGroups } from "./actions";
import { BatchCompleteClient } from "./batch-complete-client";

export default async function BatchCompletePage() {
  const data = await getAwaitingAccountingGroups();

  return <BatchCompleteClient data={data} />;
}
