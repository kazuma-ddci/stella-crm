"use client";

import { HojoLenderContactHistoryModal } from "./hojo-contact-history-modal";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";

type Props = {
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  requiredCustomerTypeId: number;
};

export function LenderContactHistorySection(props: Props) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="text-lg font-semibold mb-3">貸金業社接触履歴</h2>
      <HojoLenderContactHistoryModal
        open={true}
        onOpenChange={() => {}}
        renderInline={true}
        entityName="貸金業社"
        contactHistories={props.contactHistories}
        contactMethodOptions={props.contactMethodOptions}
        staffOptions={props.staffOptions}
        customerTypes={props.customerTypes}
        staffByProject={props.staffByProject}
        contactCategories={props.contactCategories}
        requiredCustomerTypeId={props.requiredCustomerTypeId}
      />
    </section>
  );
}
