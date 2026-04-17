"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ContactHistoryModalBase,
  type CustomerType,
  type ContactCategoryOption,
} from "@/components/contact-history-modal";
import {
  addSlpCompanyRecordContactHistory,
  addSlpAgencyContactHistory,
  updateSlpContactHistory,
  deleteSlpContactHistory,
} from "./actions";
import { ZoomRecordingSection } from "./zoom-recording-section";
import { ZoomEntriesForAdd, type ZoomAddEntry } from "./zoom-entries-for-add";
import { addManualZoomToContactHistory } from "./zoom-actions";

type BaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderInline?: boolean;
  entityId: number;
  entityName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  requiredCustomerTypeId: number;
  requiredCustomerTypeName: string;
  cacheKeyPrefix: string;
  warningLink: { href: string; label: string };
  addAction: (
    entityId: number,
    data: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  sessionSelect?: {
    options: { value: string; label: string }[];
    label?: string;
    hint?: string;
  };
};

function BaseWrapper(props: BaseProps) {
  // 新規追加時の Zoom議事録連携エントリ（複数可）
  const [zoomEntries, setZoomEntries] = useState<ZoomAddEntry[]>([]);

  // いずれかのエントリに「何か入力されている」なら未保存扱い
  const hasZoomEntryInput = zoomEntries.some(
    (e) =>
      e.zoomUrl.trim() !== "" ||
      e.label.trim() !== "" ||
      e.hostStaffId !== ""
  );

  // モーダルクローズ時にエントリをリセット（次回開いたときに前回の入力が残らないように）
  // onOpenChange のラッパーで対応（useEffect 内 setState を避ける）
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !props.renderInline) {
      setZoomEntries([]);
    }
    props.onOpenChange(nextOpen);
  };

  const processZoomEntries = async (contactHistoryId: number) => {
    // 入力されているエントリのみ処理
    const validEntries = zoomEntries.filter((e) => e.zoomUrl.trim() !== "");
    if (validEntries.length === 0) {
      setZoomEntries([]);
      return;
    }
    let successCount = 0;
    let failCount = 0;
    for (const entry of validEntries) {
      if (!entry.hostStaffId) {
        toast.error(
          `Zoom URL "${entry.zoomUrl.slice(0, 40)}..." のホストスタッフが未選択のためスキップ`
        );
        failCount++;
        continue;
      }
      const r = await addManualZoomToContactHistory({
        contactHistoryId,
        zoomUrl: entry.zoomUrl,
        hostStaffId: parseInt(entry.hostStaffId, 10),
        label: entry.label.trim() || undefined,
        mode: entry.mode,
      });
      if (r.ok) {
        successCount++;
      } else {
        failCount++;
        toast.error(`Zoom連携失敗: ${r.error}`);
      }
    }
    if (successCount > 0) {
      toast.success(`Zoom議事録連携を ${successCount}件 追加しました`);
    }
    if (failCount > 0 && successCount === 0) {
      toast.warning("Zoom連携に失敗しました。接触履歴は作成済みです。");
    }
    setZoomEntries([]);
  };

  return (
    <ContactHistoryModalBase
      open={props.open}
      onOpenChange={handleOpenChange}
      renderInline={props.renderInline}
      config={{
        entityId: props.entityId,
        entityName: props.entityName,
        requiredCustomerTypeId: props.requiredCustomerTypeId,
        requiredCustomerTypeName: props.requiredCustomerTypeName,
        cacheKeyPrefix: props.cacheKeyPrefix,
        warningLink: props.warningLink,
        actions: {
          add: props.addAction,
          update: async (id: number, data: Record<string, unknown>) => {
            const result = await updateSlpContactHistory(id, data);
            return result as unknown as Record<string, unknown>;
          },
          delete: async (id: number) => {
            await deleteSlpContactHistory(id);
          },
        },
      }}
      contactHistories={props.contactHistories}
      contactMethodOptions={props.contactMethodOptions}
      staffOptions={props.staffOptions}
      customerTypes={props.customerTypes}
      staffByProject={props.staffByProject}
      contactCategories={props.contactCategories}
      sessionSelect={props.sessionSelect}
      renderZoomSection={(contactHistoryId) => (
        <ZoomRecordingSection contactHistoryId={contactHistoryId} />
      )}
      renderZoomSectionForView={(contactHistoryId) => (
        <ZoomRecordingSection contactHistoryId={contactHistoryId} readOnly />
      )}
      autoEnterEditAfterAdd
      renderAddExtraSection={() => (
        <ZoomEntriesForAdd entries={zoomEntries} onChange={setZoomEntries} />
      )}
      onAfterAdd={async (created) => {
        await processZoomEntries(created.id);
      }}
      extraIsDirty={hasZoomEntryInput}
      onDiscard={() => setZoomEntries([])}
    />
  );
}

// ============================================
// 事業者名簿用モーダル
// ============================================
type CompanyProps = Omit<
  BaseProps,
  "requiredCustomerTypeId" | "requiredCustomerTypeName" | "cacheKeyPrefix" | "warningLink" | "addAction" | "entityId"
> & {
  slpCompanyRecordId: number;
  requiredCustomerTypeId: number; // slp_company の解決済みID（Serverで取得）
  sessionSelect?: BaseProps["sessionSelect"];
};

export function SlpCompanyContactHistoryModal({
  slpCompanyRecordId,
  requiredCustomerTypeId,
  ...rest
}: CompanyProps) {
  return (
    <BaseWrapper
      {...rest}
      entityId={slpCompanyRecordId}
      requiredCustomerTypeId={requiredCustomerTypeId}
      requiredCustomerTypeName="事業者"
      cacheKeyPrefix="slp-company-contact-history"
      warningLink={{ href: "/slp/agencies", label: "代理店管理" }}
      addAction={async (entityId, data) => {
        const r = await addSlpCompanyRecordContactHistory(
          entityId,
          data as Parameters<typeof addSlpCompanyRecordContactHistory>[1]
        );
        return r as unknown as Record<string, unknown>;
      }}
    />
  );
}

// ============================================
// 代理店管理用モーダル
// ============================================
type AgencyProps = Omit<
  BaseProps,
  "requiredCustomerTypeId" | "requiredCustomerTypeName" | "cacheKeyPrefix" | "warningLink" | "addAction" | "entityId"
> & {
  slpAgencyId: number;
  requiredCustomerTypeId: number; // slp_agency の解決済みID（Serverで取得）
};

export function SlpAgencyContactHistoryModal({
  slpAgencyId,
  requiredCustomerTypeId,
  ...rest
}: AgencyProps) {
  return (
    <BaseWrapper
      {...rest}
      entityId={slpAgencyId}
      requiredCustomerTypeId={requiredCustomerTypeId}
      requiredCustomerTypeName="代理店"
      cacheKeyPrefix="slp-agency-contact-history"
      warningLink={{ href: "/slp/companies", label: "事業者名簿" }}
      addAction={async (entityId, data) => {
        const r = await addSlpAgencyContactHistory(
          entityId,
          data as Parameters<typeof addSlpAgencyContactHistory>[1]
        );
        return r as unknown as Record<string, unknown>;
      }}
    />
  );
}
