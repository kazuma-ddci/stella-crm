"use client";

import {
  ContactHistoryV2Form as SharedForm,
  type TargetTypeSpec,
  type ContactHistoryFormInitial,
  type ExistingMeetingInfo,
} from "@/components/contact-history-v2/form";
import { createContactHistoryV2, updateContactHistoryV2 } from "./actions";
import type { StpContactHistoryV2Masters } from "./load-masters";

export type { ContactHistoryFormInitial, ExistingMeetingInfo };

type Props = {
  mode: "create" | "edit";
  masters: StpContactHistoryV2Masters;
  initial?: ContactHistoryFormInitial;
  existingMeetings?: ExistingMeetingInfo[];
};

/**
 * STP 接触履歴 V2 フォーム。SharedForm ラッパー。
 * STP は stp_company (顧客企業) / stp_agent (代理店) / stp_other (その他)。
 */
export function ContactHistoryV2Form({
  mode,
  masters,
  initial,
  existingMeetings,
}: Props) {
  const targetTypeSpecs: TargetTypeSpec[] = [
    {
      value: "stp_company",
      label: "顧客企業",
      requiresTargetId: true,
      idOptions: masters.companies,
    },
    {
      value: "stp_agent",
      label: "代理店",
      requiresTargetId: true,
      idOptions: masters.agents,
    },
    {
      value: "stp_other",
      label: "その他",
      requiresTargetId: false,
      idOptions: [],
    },
  ];

  return (
    <SharedForm
      mode={mode}
      projectName="STP"
      basePath="/stp/records/contact-histories-v2"
      masters={{
        contactMethods: masters.contactMethods,
        contactCategories: masters.contactCategories,
        projectStaffOptions: masters.projectStaffOptions,
        otherStaffOptions: masters.otherStaffOptions,
      }}
      targetTypeSpecs={targetTypeSpecs}
      defaultTargetType="stp_company"
      initial={initial}
      existingMeetings={existingMeetings}
      onCreate={createContactHistoryV2}
      onUpdate={updateContactHistoryV2}
    />
  );
}
