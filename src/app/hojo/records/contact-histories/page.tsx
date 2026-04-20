import {
  loadHojoContactHistoryMasters,
  loadActiveHojoVendorOptions,
} from "@/app/hojo/contact-histories/loaders";
import { listHojoContactHistories } from "@/app/hojo/contact-histories/actions";
import { ContactHistoriesClient } from "./contact-histories-client";

export default async function HojoContactHistoriesRecordsPage() {
  const [histories, masters, vendorOptions] = await Promise.all([
    listHojoContactHistories(),
    loadHojoContactHistoryMasters(),
    loadActiveHojoVendorOptions(),
  ]);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">接触履歴</h1>
      <p className="text-sm text-gray-600">
        HOJOプロジェクトで記録された接触履歴の一覧です。ベンダー・BBS・貸金業社・その他でフィルタできます。
      </p>
      <ContactHistoriesClient
        histories={histories as unknown as Record<string, unknown>[]}
        contactMethodOptions={masters.contactMethodOptions}
        staffOptions={masters.staffOptions}
        customerTypes={masters.customerTypes}
        staffByProject={masters.staffByProject}
        contactCategories={masters.contactCategories}
        vendorOptions={vendorOptions}
        hojoVendorCustomerTypeId={masters.hojoVendorCustomerTypeId}
        hojoBbsCustomerTypeId={masters.hojoBbsCustomerTypeId}
        hojoLenderCustomerTypeId={masters.hojoLenderCustomerTypeId}
        hojoOtherCustomerTypeId={masters.hojoOtherCustomerTypeId}
      />
    </div>
  );
}
