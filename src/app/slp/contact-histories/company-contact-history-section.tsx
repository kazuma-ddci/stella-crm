"use client";

import { SlpCompanyContactHistoryModal } from "./slp-contact-history-modal";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";

type Props = {
  companyRecordId: number;
  companyName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  requiredCustomerTypeId: number;
  sessionOptions?: { value: string; label: string }[];
};

export function SlpCompanyContactHistorySection(props: Props) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold mb-3">接触履歴</h2>
      <SlpCompanyContactHistoryModal
        open={true}
        onOpenChange={() => {}}
        renderInline={true}
        slpCompanyRecordId={props.companyRecordId}
        entityName={props.companyName}
        contactHistories={props.contactHistories}
        contactMethodOptions={props.contactMethodOptions}
        staffOptions={props.staffOptions}
        customerTypes={props.customerTypes}
        staffByProject={props.staffByProject}
        contactCategories={props.contactCategories}
        requiredCustomerTypeId={props.requiredCustomerTypeId}
        sessionSelect={
          props.sessionOptions && props.sessionOptions.length > 0
            ? {
                options: props.sessionOptions,
                label: "打ち合わせに紐付け（任意）",
                hint: "商談タブの該当打ち合わせからこの接触履歴を確認できるようになります。",
              }
            : undefined
        }
      />
    </section>
  );
}
