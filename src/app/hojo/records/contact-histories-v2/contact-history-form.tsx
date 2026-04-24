"use client";

import {
  ContactHistoryV2Form as SharedForm,
  type TargetTypeSpec,
  type ContactHistoryFormInitial,
  type ExistingMeetingInfo,
} from "@/components/contact-history-v2/form";
import { createContactHistoryV2, updateContactHistoryV2 } from "./actions";
import type { HojoContactHistoryV2Masters } from "./load-masters";

export type { ContactHistoryFormInitial, ExistingMeetingInfo };

type Props = {
  mode: "create" | "edit";
  masters: HojoContactHistoryV2Masters;
  initial?: ContactHistoryFormInitial;
  existingMeetings?: ExistingMeetingInfo[];
};

/**
 * HOJO 接触履歴 V2 フォーム。SharedForm ラッパー。
 * HOJO では hojo_vendor のみ targetId が必要 (他3種はID不要)。
 */
export function ContactHistoryV2Form({
  mode,
  masters,
  initial,
  existingMeetings,
}: Props) {
  const targetTypeSpecs: TargetTypeSpec[] = [
    {
      value: "hojo_vendor",
      label: "ベンダー",
      requiresTargetId: true,
      idOptions: masters.vendors,
    },
    {
      value: "hojo_bbs",
      label: "BBS",
      requiresTargetId: false,
      idOptions: [],
    },
    {
      value: "hojo_lender",
      label: "貸金業者",
      requiresTargetId: false,
      idOptions: [],
    },
    {
      value: "hojo_other",
      label: "その他",
      requiresTargetId: false,
      idOptions: [],
    },
  ];

  return (
    <SharedForm
      mode={mode}
      projectName="HOJO"
      basePath="/hojo/records/contact-histories-v2"
      masters={{
        contactMethods: masters.contactMethods,
        contactCategories: masters.contactCategories,
        projectStaffOptions: masters.projectStaffOptions,
        otherStaffOptions: masters.otherStaffOptions,
      }}
      targetTypeSpecs={targetTypeSpecs}
      defaultTargetType="hojo_vendor"
      initial={initial}
      existingMeetings={existingMeetings}
      onCreate={createContactHistoryV2}
      onUpdate={updateContactHistoryV2}
    />
  );
}
