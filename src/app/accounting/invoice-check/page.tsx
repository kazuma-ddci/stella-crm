import { getInvoiceMismatchedJournals } from "./actions";
import { InvoiceCheckClient } from "./invoice-check-client";

export default async function InvoiceCheckPage() {
  const data = await getInvoiceMismatchedJournals();
  return <InvoiceCheckClient data={data} />;
}
