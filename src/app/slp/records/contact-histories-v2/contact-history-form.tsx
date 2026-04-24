"use client";

import {
  ContactHistoryV2Form as SharedForm,
  type TargetTypeSpec,
  type ContactHistoryFormInitial,
  type ExistingMeetingInfo,
} from "@/components/contact-history-v2/form";
import { createContactHistoryV2, updateContactHistoryV2 } from "./actions";
import type { SlpContactHistoryV2Masters } from "./load-masters";

// 再エクスポート (既存ページの import 経路を維持)
export type { ContactHistoryFormInitial, ExistingMeetingInfo };

type Props = {
  mode: "create" | "edit";
  masters: SlpContactHistoryV2Masters;
  initial?: ContactHistoryFormInitial;
  existingMeetings?: ExistingMeetingInfo[];
};

/**
 * SLP 接触履歴 V2 フォーム。共通コンポーネント SharedForm の薄いラッパー。
 * SLP 固有の target type と顧客マスタを設定して渡す。
 */
export function ContactHistoryV2Form({
  mode,
  masters,
  initial,
  existingMeetings,
}: Props) {
  const targetTypeSpecs: TargetTypeSpec[] = [
    {
      value: "slp_company_record",
      label: "事業者",
      requiresTargetId: true,
      idOptions: masters.companyRecords,
    },
    {
      value: "slp_agency",
      label: "代理店",
      requiresTargetId: true,
      idOptions: masters.agencies,
    },
    {
      value: "slp_line_friend",
      label: "LINE友達",
      requiresTargetId: true,
      idOptions: masters.lineFriends,
    },
    {
      value: "slp_other",
      label: "その他",
      requiresTargetId: false,
      idOptions: [],
    },
  ];

  return (
    <SharedForm
      mode={mode}
      projectName="SLP"
      basePath="/slp/records/contact-histories-v2"
      masters={{
        contactMethods: masters.contactMethods,
        contactCategories: masters.contactCategories,
        projectStaffOptions: masters.projectStaffOptions,
        otherStaffOptions: masters.otherStaffOptions,
      }}
      targetTypeSpecs={targetTypeSpecs}
      defaultTargetType="slp_company_record"
      initial={initial}
      existingMeetings={existingMeetings}
      onCreate={createContactHistoryV2}
      onUpdate={updateContactHistoryV2}
    />
  );
}
