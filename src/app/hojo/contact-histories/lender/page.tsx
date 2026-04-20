import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  loadHojoContactHistoryMasters,
  loadContactHistoriesForLender,
} from "@/app/hojo/contact-histories/loaders";
import { LenderContactHistorySection } from "@/app/hojo/contact-histories/lender-contact-history-section";

export default async function LenderContactHistoriesPage() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);

  const [contactMasters, contactHistories] = await Promise.all([
    loadHojoContactHistoryMasters(),
    loadContactHistoriesForLender(),
  ]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">貸金業社接触履歴</h1>
        <p className="text-sm text-muted-foreground mt-1">
          貸金業社との接触履歴を記録・管理します。
        </p>
      </div>

      <LenderContactHistorySection
        contactHistories={contactHistories as unknown as Record<string, unknown>[]}
        contactMethodOptions={contactMasters.contactMethodOptions}
        staffOptions={contactMasters.staffOptions}
        customerTypes={contactMasters.customerTypes}
        staffByProject={contactMasters.staffByProject}
        contactCategories={contactMasters.contactCategories}
        requiredCustomerTypeId={contactMasters.hojoLenderCustomerTypeId}
      />
    </div>
  );
}
