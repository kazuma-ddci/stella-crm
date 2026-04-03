"use client";

import {
  ContactHistoryModalBase,
  type CustomerType,
  type ContactCategoryOption,
} from "@/components/contact-history-modal";
import {
  addAgentContactHistory,
  updateAgentContactHistory,
  deleteAgentContactHistory,
} from "./contact-history-actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: number;
  agentName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
};

export function ContactHistoryModal({
  open,
  onOpenChange,
  agentId,
  agentName,
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
      config={{
        entityId: agentId,
        entityName: agentName,
        requiredCustomerTypeId: 2,
        requiredCustomerTypeName: "代理店",
        cacheKeyPrefix: "agent-contact-history",
        warningLink: { href: "/stp/companies", label: "STP企業一覧" },
        popoverWidth: "w-[calc(100vw-2rem)] sm:w-[400px]",
        actions: {
          add: addAgentContactHistory,
          update: updateAgentContactHistory,
          delete: deleteAgentContactHistory,
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
