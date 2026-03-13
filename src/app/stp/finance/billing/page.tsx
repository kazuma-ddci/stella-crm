import { getAvailableMonths } from "./actions";
import { BillingLifecycleView } from "./billing-lifecycle-view";

export default async function BillingLifecyclePage() {
  const availableMonths = await getAvailableMonths();

  return <BillingLifecycleView availableMonths={availableMonths} />;
}
