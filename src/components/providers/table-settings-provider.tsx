"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { updateTableSetting as updateTableSettingAction } from "@/app/actions/table-settings";

export type TableSetting = {
  stickyLeftCount?: number;
};

export type TableSettingsMap = Record<string, TableSetting | undefined>;

type TableSettingsContextValue = {
  settings: TableSettingsMap;
  /** 現在のユーザーが列固定設定（ピン留め）を保存できるか（スタッフ/貸金業社など） */
  canManagePinning: boolean;
  getSetting: (tableId: string) => TableSetting | undefined;
  updateStickyLeftCount: (tableId: string, count: number) => Promise<void>;
};

const TableSettingsContext = createContext<TableSettingsContextValue | null>(null);

export function TableSettingsProvider({
  initial,
  canManagePinning,
  children,
}: {
  initial: TableSettingsMap;
  canManagePinning: boolean;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<TableSettingsMap>(initial ?? {});

  const getSetting = useCallback(
    (tableId: string) => settings[tableId],
    [settings],
  );

  const updateStickyLeftCount = useCallback(
    async (tableId: string, count: number) => {
      // 楽観的更新 — 同時に直前の値を捕捉してロールバック用に保存
      let prevSetting: TableSetting | undefined;
      setSettings((prev) => {
        prevSetting = prev[tableId];
        return {
          ...prev,
          [tableId]: { ...(prev[tableId] ?? {}), stickyLeftCount: count },
        };
      });

      const rollback = () => {
        setSettings((prev) => {
          const next = { ...prev };
          if (prevSetting === undefined) {
            delete next[tableId];
          } else {
            next[tableId] = prevSetting;
          }
          return next;
        });
      };

      try {
        const result = await updateTableSettingAction(tableId, {
          stickyLeftCount: count,
        });
        if (!result.ok) {
          rollback();
          toast.error(`列固定の保存に失敗しました: ${result.error}`);
        }
      } catch (e) {
        rollback();
        const message =
          e instanceof Error ? e.message : "テーブル設定の保存に失敗しました";
        toast.error(`列固定の保存に失敗しました: ${message}`);
        console.error("[TableSettingsProvider] updateStickyLeftCount failed:", e);
      }
    },
    [],
  );

  const value = useMemo<TableSettingsContextValue>(
    () => ({ settings, canManagePinning, getSetting, updateStickyLeftCount }),
    [settings, canManagePinning, getSetting, updateStickyLeftCount],
  );

  return (
    <TableSettingsContext.Provider value={value}>
      {children}
    </TableSettingsContext.Provider>
  );
}

export function useTableSettings(): TableSettingsContextValue | null {
  return useContext(TableSettingsContext);
}
