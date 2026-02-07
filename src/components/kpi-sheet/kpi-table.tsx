"use client";

import { useState, useCallback, Fragment } from "react";
import { KpiCell } from "./kpi-cell";
import {
  KpiWeeklyData,
  KPI_METRICS,
  KpiMetricKey,
  KpiDataType,
  getFieldName,
  calculateDiff,
  isManualInput,
  calculateMetricValue,
} from "./types";
import { cn, toLocalDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("ja", ja);
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface KpiTableProps {
  weeklyData: KpiWeeklyData[];
  editable?: boolean;
  onCellUpdate?: (
    weeklyDataId: number,
    field: string,
    value: number | null
  ) => Promise<void>;
  onAddWeek?: (startDate: string, endDate: string) => Promise<void>;
  onDeleteWeek?: (weeklyDataId: number) => Promise<void>;
  onUpdateStartDate?: (weeklyDataId: number, startDate: string) => Promise<void>;
}

// 日付フォーマット（月/日）
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 日付フォーマット（月日形式）
function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 月を取得
function getMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月`;
}

// 週データを月ごとにグループ化
function groupByMonth(
  data: KpiWeeklyData[]
): Map<string, KpiWeeklyData[]> {
  const groups = new Map<string, KpiWeeklyData[]>();

  data.forEach((week) => {
    const month = getMonth(week.weekStartDate);
    if (!groups.has(month)) {
      groups.set(month, []);
    }
    groups.get(month)!.push(week);
  });

  return groups;
}

// 行タイプ
type RowType = "target" | "actual" | "diff";

// セクション設定
const SECTION_CONFIG: {
  type: RowType;
  label: string;
  headerBg: string;
}[] = [
  { type: "target", label: "目標", headerBg: "bg-amber-100" },
  { type: "actual", label: "実績", headerBg: "bg-teal-100" },
  { type: "diff", label: "差分", headerBg: "bg-gray-100" },
];

// 開始日編集コンポーネント
function StartDateEditor({
  weekId,
  currentDate,
  onSave,
}: {
  weekId: number;
  currentDate: string;
  onSave: (weekId: number, newDate: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(currentDate);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === currentDate) {
      setIsOpen(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(weekId, editValue);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update start date:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center justify-center gap-1 hover:bg-gray-600 px-1 rounded cursor-pointer whitespace-nowrap text-white">
          <span>{formatDateFull(currentDate)}</span>
          <Pencil className="h-3 w-3 text-white/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">開始日を変更</label>
          <DatePicker
            selected={editValue ? new Date(editValue) : null}
            onChange={(date: Date | null) => setEditValue(date ? toLocalDateString(date) : "")}
            dateFormat="yyyy/MM/dd"
            locale="ja"
            placeholderText="日付を選択"
            disabled={isSaving}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              保存
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function KpiTable({
  weeklyData,
  editable = false,
  onCellUpdate,
  onAddWeek,
  onDeleteWeek,
  onUpdateStartDate,
}: KpiTableProps) {
  // 次の週を追加
  const handleAddWeek = useCallback(async () => {
    if (!onAddWeek) return;

    let startDate: Date;
    let endDate: Date;

    if (weeklyData.length === 0) {
      // 今週から開始
      startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay()); // 週の初め（日曜日）
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      // 最後の週の次
      const lastWeek = weeklyData[weeklyData.length - 1];
      startDate = new Date(lastWeek.weekEndDate);
      startDate.setDate(startDate.getDate() + 1);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    }

    await onAddWeek(
      toLocalDateString(startDate),
      toLocalDateString(endDate)
    );
  }, [weeklyData, onAddWeek]);

  // 手入力データを取得（計算に使用）
  const getManualInputData = useCallback(
    (week: KpiWeeklyData, dataType: KpiDataType) => {
      return {
        impressions: week[`${dataType}Impressions` as keyof KpiWeeklyData] as number | null,
        clicks: week[`${dataType}Clicks` as keyof KpiWeeklyData] as number | null,
        applications: week[`${dataType}Applications` as keyof KpiWeeklyData] as number | null,
        cost: week[`${dataType}Cost` as keyof KpiWeeklyData] as number | null,
      };
    },
    []
  );

  // セルの値を取得（計算項目は自動計算）
  const getCellValue = useCallback(
    (
      week: KpiWeeklyData,
      metric: KpiMetricKey,
      rowType: RowType
    ): number | null => {
      if (rowType === "diff") {
        // 差分：実績 - 目標
        const targetValue = getCellValue(week, metric, "target");
        const actualValue = getCellValue(week, metric, "actual");
        return calculateDiff(targetValue, actualValue);
      }

      // 手入力項目は直接値を返す
      if (isManualInput(metric)) {
        const field = getFieldName(
          rowType as KpiDataType,
          metric
        ) as keyof KpiWeeklyData;
        return week[field] as number | null;
      }

      // 計算項目は算出
      const inputData = getManualInputData(week, rowType as KpiDataType);
      return calculateMetricValue(metric, inputData);
    },
    [getManualInputData]
  );

  // 月ごとにグループ化
  const monthGroups = groupByMonth(weeklyData);

  // スクロール制御
  const handleScroll = useCallback((direction: "left" | "right") => {
    const container = document.getElementById("kpi-table-container");
    if (container) {
      const scrollAmount = 300;
      const newPosition =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount;
      container.scrollTo({ left: newPosition, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="relative">
      {/* スクロールボタン */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {editable && onAddWeek && (
          <Button variant="outline" size="sm" onClick={handleAddWeek}>
            <Plus className="h-4 w-4 mr-1" />
            週を追加
          </Button>
        )}
      </div>

      {/* テーブル */}
      <div
        id="kpi-table-container"
        className="overflow-x-auto border rounded-lg"
      >
        <table className="min-w-full border-collapse text-sm">
          <thead>
            {/* 月行 */}
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-20 bg-slate-50 border-r border-b w-28 min-w-[112px] px-2 py-1 text-left whitespace-nowrap">
                月
              </th>
              {Array.from(monthGroups.entries()).map(([month, weeks]) => (
                <th
                  key={month}
                  colSpan={weeks.length}
                  className="border-r border-b px-2 py-1 text-center font-medium min-w-[100px]"
                >
                  {month}
                </th>
              ))}
            </tr>

            {/* 開始行 */}
            <tr className="bg-gray-700 text-white">
              <th className="sticky left-0 z-20 bg-gray-700 border-r border-b px-2 py-1 text-left font-medium whitespace-nowrap">
                開始
              </th>
              {weeklyData.map((week) => (
                <th
                  key={`start-${week.id}`}
                  className="border-r border-b px-1 py-1 text-center font-normal min-w-[100px]"
                >
                  {editable && onUpdateStartDate ? (
                    <StartDateEditor
                      weekId={week.id}
                      currentDate={week.weekStartDate}
                      onSave={onUpdateStartDate}
                    />
                  ) : (
                    <span className="whitespace-nowrap">{formatDateFull(week.weekStartDate)}</span>
                  )}
                </th>
              ))}
            </tr>

            {/* 終了行 */}
            <tr className="bg-gray-700 text-white">
              <th className="sticky left-0 z-20 bg-gray-700 border-r border-b px-2 py-1 text-left font-medium whitespace-nowrap">
                終了
              </th>
              {weeklyData.map((week) => (
                <th
                  key={`end-${week.id}`}
                  className="border-r border-b px-1 py-1 text-center font-normal min-w-[100px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="whitespace-nowrap">{formatDateFull(week.weekEndDate)}</span>
                    {editable && onDeleteWeek && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-white/70 hover:text-white hover:bg-gray-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>週を削除</AlertDialogTitle>
                            <AlertDialogDescription>
                              {formatDateFull(week.weekStartDate)} 〜{" "}
                              {formatDateFull(week.weekEndDate)}
                              のデータを削除しますか？この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDeleteWeek(week.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* セクションごとにレンダリング */}
            {SECTION_CONFIG.map((section) => (
              <Fragment key={`section-group-${section.type}`}>
                {/* セクションヘッダー行（黄色背景） */}
                <tr
                  className={cn(section.headerBg, "border-t-2 border-gray-400")}
                >
                  <td className={cn("sticky left-0 z-10 border-r border-b px-2 py-1 font-bold text-slate-800", section.headerBg)}>
                    {section.label}
                  </td>
                  {weeklyData.map((week) => (
                    <td
                      key={`section-${section.type}-${week.id}`}
                      className={cn("border-r border-b", section.headerBg)}
                    />
                  ))}
                </tr>

                {/* メトリクス行 */}
                {KPI_METRICS.map((metric) => {
                  const isManual = isManualInput(metric.key);
                  const isDiff = section.type === "diff";
                  // 手入力項目は薄いハイライト、計算項目は白背景
                  const cellBg = isDiff
                    ? "bg-white"
                    : isManual
                    ? "bg-amber-50"
                    : "bg-white";

                  return (
                    <tr key={`${section.type}-${metric.key}`}>
                      {/* ラベルセル */}
                      <td
                        className={cn(
                          "sticky left-0 z-10 border-r border-b px-2 py-1 text-right whitespace-nowrap",
                          cellBg
                        )}
                      >
                        <span className="text-xs font-medium text-slate-600">{metric.label}</span>
                      </td>

                      {/* データセル */}
                      {weeklyData.map((week) => {
                        const cellValue = getCellValue(
                          week,
                          metric.key,
                          section.type
                        );
                        // 差分行と計算項目は編集不可
                        const isEditable =
                          editable && !isDiff && isManual && !!onCellUpdate;
                        const field = getFieldName(
                          section.type === "diff"
                            ? "actual"
                            : (section.type as KpiDataType),
                          metric.key
                        );

                        return (
                          <td
                            key={`${week.id}-${metric.key}-${section.type}`}
                            className={cn(
                              "border-r border-b",
                              cellBg,
                              isDiff &&
                                cellValue !== null &&
                                cellValue > 0 &&
                                "text-green-600",
                              isDiff &&
                                cellValue !== null &&
                                cellValue < 0 &&
                                "text-red-600"
                            )}
                          >
                            <KpiCell
                              value={cellValue}
                              type={metric.type}
                              editable={isEditable}
                              bgColor={cellBg}
                              onSave={
                                isEditable
                                  ? (value) => onCellUpdate!(week.id, field, value)
                                  : undefined
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {weeklyData.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          まだデータがありません。「週を追加」ボタンをクリックして開始してください。
        </div>
      )}
    </div>
  );
}
