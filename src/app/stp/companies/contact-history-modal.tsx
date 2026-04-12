"use client";

import {
  ContactHistoryModalBase,
  type CustomerType,
  type ContactCategoryOption,
} from "@/components/contact-history-modal";
import {
  addCompanyContactHistory,
  updateCompanyContactHistory,
  deleteCompanyContactHistory,
} from "./contact-history-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderInline?: boolean;
  stpCompanyId: number;
  companyName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
};

export function CompanyContactHistoryModal({
  open,
  onOpenChange,
  renderInline,
  stpCompanyId,
  companyName,
  contactHistories,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
  contactCategories,
}: Props) {
  return (
    <ContactHistoryModalBase
      open={open}
      onOpenChange={onOpenChange}
      renderInline={renderInline}
      config={{
        entityId: stpCompanyId,
        entityName: companyName,
        requiredCustomerTypeId: 1,
        requiredCustomerTypeName: "企業",
        cacheKeyPrefix: "company-contact-history",
        warningLink: { href: "/stp/agents", label: "代理店一覧" },
        actions: {
          add: addCompanyContactHistory,
          update: updateCompanyContactHistory,
          delete: deleteCompanyContactHistory,
        },
      }}
      contactHistories={contactHistories}
      contactMethodOptions={contactMethodOptions}
      staffOptions={staffOptions}
      customerTypes={customerTypes}
      staffByProject={staffByProject}
      contactCategories={contactCategories}
    />
  );
}
