import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  loadHojoContactHistoryMasters,
  loadContactHistoriesForBbs,
} from "@/app/hojo/contact-histories/loaders";
import { BbsContactHistorySection } from "@/app/hojo/contact-histories/bbs-contact-history-section";

export default async function BbsContactHistoriesPage() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);

  const [contactMasters, contactHistories] = await Promise.all([
    loadHojoContactHistoryMasters(),
    loadContactHistoriesForBbs(),
  ]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">BBS接触履歴</h1>
        <p className="text-sm text-muted-foreground mt-1">
          BBS社との接触履歴を記録・管理します。
        </p>
      </div>

      <BbsContactHistorySection
        contactHistories={contactHistories as unknown as Record<string, unknown>[]}
        contactMethodOptions={contactMasters.contactMethodOptions}
        staffOptions={contactMasters.staffOptions}
        customerTypes={contactMasters.customerTypes}
        staffByProject={contactMasters.staffByProject}
        contactCategories={contactMasters.contactCategories}
        requiredCustomerTypeId={contactMasters.hojoBbsCustomerTypeId}
      />
    </div>
  );
}
