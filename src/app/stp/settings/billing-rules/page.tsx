import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getBillingRules } from "./actions";
import { BillingRulesForm } from "./billing-rules-form";

export default async function BillingRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rules = await getBillingRules();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">請求ルール設定</h1>
      <BillingRulesForm initialRules={rules} />
    </div>
  );
}
