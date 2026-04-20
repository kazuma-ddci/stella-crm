"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ContactHistoryModalBase,
  type CustomerType,
  type ContactCategoryOption,
} from "@/components/contact-history-modal";
import {
  addHojoVendorContactHistory,
  addHojoBbsContactHistory,
  addHojoLenderContactHistory,
  updateHojoContactHistory,
  deleteHojoContactHistory,
} from "./actions";
import { ZoomRecordingSection } from "./zoom-recording-section";
import { ZoomEntriesForAdd, type ZoomAddEntry } from "./zoom-entries-for-add";
import { addManualZoomToHojoContactHistory } from "./zoom-actions";

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
};

function BaseWrapper(props: BaseProps) {
  const [zoomEntries, setZoomEntries] = useState<ZoomAddEntry[]>([]);

  const hasZoomEntryInput = zoomEntries.some(
    (e) =>
      e.zoomUrl.trim() !== "" ||
      e.label.trim() !== "" ||
      e.hostStaffId !== ""
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !props.renderInline) {
      setZoomEntries([]);
    }
    props.onOpenChange(nextOpen);
  };

  const processZoomEntries = async (
    contactHistoryId: number,
    toastId: string | number
  ) => {
    const validEntries = zoomEntries.filter((e) => e.zoomUrl.trim() !== "");
    if (validEntries.length === 0) {
      toast.success("接触履歴を追加しました", { id: toastId });
      setZoomEntries([]);
      return;
    }

    toast.loading(
      `Zoom議事録を連携中... (0/${validEntries.length})`,
      { id: toastId }
    );

    let successCount = 0;
    let failCount = 0;
    const failureReasons: string[] = [];

    for (let i = 0; i < validEntries.length; i++) {
      const entry = validEntries[i];
      toast.loading(
        `Zoom議事録を連携中... (${i + 1}/${validEntries.length})`,
        { id: toastId }
      );
      if (!entry.hostStaffId) {
        failCount++;
        failureReasons.push(
          `"${entry.zoomUrl.slice(0, 40)}..." ホストスタッフ未選択`
        );
        continue;
      }
      const r = await addManualZoomToHojoContactHistory({
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
        failureReasons.push(r.error);
      }
    }

    if (failCount === 0) {
      toast.success(
        `接触履歴を追加しました（Zoom議事録${successCount}件連携）`,
        { id: toastId }
      );
    } else if (successCount > 0) {
      toast.warning(
        `接触履歴を追加しました（Zoom連携: 成功${successCount}件・失敗${failCount}件）`,
        {
          id: toastId,
          description: failureReasons.slice(0, 3).join(" / "),
          duration: 10000,
        }
      );
    } else {
      toast.warning(
        "接触履歴は追加しましたが、Zoom議事録連携に失敗しました",
        {
          id: toastId,
          description: failureReasons.slice(0, 3).join(" / "),
          duration: 10000,
        }
      );
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
            const result = await updateHojoContactHistory(id, data);
            return result as unknown as Record<string, unknown>;
          },
          delete: async (id: number) => {
            await deleteHojoContactHistory(id);
          },
        },
      }}
      contactHistories={props.contactHistories}
      contactMethodOptions={props.contactMethodOptions}
      staffOptions={props.staffOptions}
      customerTypes={props.customerTypes}
      staffByProject={props.staffByProject}
      contactCategories={props.contactCategories}
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
      onAfterAdd={async (created, ctx) => {
        await processZoomEntries(created.id, ctx.toastId);
      }}
      extraIsDirty={hasZoomEntryInput}
      onDiscard={() => setZoomEntries([])}
    />
  );
}

// ============================================
// ベンダー用
// ============================================
type VendorProps = Omit<
  BaseProps,
  "requiredCustomerTypeId" | "requiredCustomerTypeName" | "cacheKeyPrefix" | "warningLink" | "addAction" | "entityId"
> & {
  vendorId: number;
  requiredCustomerTypeId: number;
};

export function HojoVendorContactHistoryModal({
  vendorId,
  requiredCustomerTypeId,
  ...rest
}: VendorProps) {
  return (
    <BaseWrapper
      {...rest}
      entityId={vendorId}
      requiredCustomerTypeId={requiredCustomerTypeId}
      requiredCustomerTypeName="ベンダー"
      cacheKeyPrefix="hojo-vendor-contact-history"
      warningLink={{ href: "/hojo/settings/vendors", label: "ベンダー管理" }}
      addAction={async (entityId, data) => {
        const r = await addHojoVendorContactHistory(
          entityId,
          data as Parameters<typeof addHojoVendorContactHistory>[1]
        );
        return r as unknown as Record<string, unknown>;
      }}
    />
  );
}

// ============================================
// BBS用（アカウント紐付け無し、顧客種別タグ=BBSで分類）
// ============================================
type BbsProps = Omit<
  BaseProps,
  "requiredCustomerTypeId" | "requiredCustomerTypeName" | "cacheKeyPrefix" | "warningLink" | "addAction" | "entityId"
> & {
  requiredCustomerTypeId: number;
};

export function HojoBbsContactHistoryModal({
  requiredCustomerTypeId,
  ...rest
}: BbsProps) {
  return (
    <BaseWrapper
      {...rest}
      entityId={0}
      requiredCustomerTypeId={requiredCustomerTypeId}
      requiredCustomerTypeName="BBS"
      cacheKeyPrefix="hojo-bbs-contact-history"
      warningLink={{ href: "/hojo/contact-histories/bbs", label: "BBS接触履歴" }}
      addAction={async (entityId, data) => {
        const r = await addHojoBbsContactHistory(
          entityId,
          data as Parameters<typeof addHojoBbsContactHistory>[1]
        );
        return r as unknown as Record<string, unknown>;
      }}
    />
  );
}

// ============================================
// 貸金業社用（アカウント紐付け無し、顧客種別タグ=貸金業社で分類）
// ============================================
type LenderProps = Omit<
  BaseProps,
  "requiredCustomerTypeId" | "requiredCustomerTypeName" | "cacheKeyPrefix" | "warningLink" | "addAction" | "entityId"
> & {
  requiredCustomerTypeId: number;
};

export function HojoLenderContactHistoryModal({
  requiredCustomerTypeId,
  ...rest
}: LenderProps) {
  return (
    <BaseWrapper
      {...rest}
      entityId={0}
      requiredCustomerTypeId={requiredCustomerTypeId}
      requiredCustomerTypeName="貸金業社"
      cacheKeyPrefix="hojo-lender-contact-history"
      warningLink={{
        href: "/hojo/contact-histories/lender",
        label: "貸金業社接触履歴",
      }}
      addAction={async (entityId, data) => {
        const r = await addHojoLenderContactHistory(
          entityId,
          data as Parameters<typeof addHojoLenderContactHistory>[1]
        );
        return r as unknown as Record<string, unknown>;
      }}
    />
  );
}
