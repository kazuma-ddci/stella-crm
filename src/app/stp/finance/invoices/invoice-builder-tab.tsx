"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Save,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getInvoiceGroupDetail,
  addMemoLine,
  updateMemoLine,
  deleteMemoLine,
  updateLineOrder,
  updateInvoiceGroup,
  generateInvoicePdf,
} from "./actions";
import { InvoicePreview } from "./invoice-preview";
import {
  buildDefaultDescription,
  formatPeriodRange,
} from "@/lib/invoices/description-utils";

// ============================================
// 型定義
// ============================================

type InvoiceBuilderTabProps = {
  groupId: number;
  projectId?: number;
  onInvoiceCreated?: () => void;
  onPdfGenerated?: (pdfPath: string) => void;
  isEditable?: boolean;
  invoiceDate?: string;
  paymentDueDate?: string;
  onInvoiceDateChange?: (date: string) => void;
  onPaymentDueDateChange?: (date: string) => void;
};

// getInvoiceGroupDetail から返されるデータの型
// 別エージェントが actions.ts に追加する前提
type GroupDetailData = {
  id: number;
  counterpartyName: string;
  counterpartyId: number;
  operatingCompanyName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paymentDueDate: string | null;
  honorific: string;
  remarks: string | null;
  lineOrder: string[] | null;
  lineDescriptions: Record<string, string> | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  bankAccountId: number | null;
  bankAccountLabel: string | null;
  bankAccount: {
    bankName: string;
    branchName: string;
    branchCode: string;
    accountNumber: string;
    accountHolderName: string;
  } | null;
  operatingCompany: {
    companyName: string;
    registrationNumber: string | null;
    postalCode: string | null;
    address: string | null;
    address2: string | null;
    representativeName: string | null;
    phone: string | null;
    logoPath: string | null;
  };
  transactions: {
    id: number;
    expenseCategoryName: string;
    amount: number;
    taxAmount: number;
    taxRate: number;
    taxType: string;
    periodFrom: string;
    periodTo: string;
    note: string | null;
  }[];
  memoLines: {
    id: number;
    description: string;
    sortOrder: number;
  }[];
  taxSummary: Record<string, { subtotal: number; tax: number }>;
};

// ローカルメモ行の型（新規追加はtempIdを使う）
type LocalMemoLine = {
  id: number; // 既存は正のID、新規はnegative temp ID
  description: string;
  sortOrder: number;
  isNew?: boolean;
  isDeleted?: boolean;
  originalDescription?: string; // 変更検知用
};

// lineOrder内の各アイテム
type OrderItem = {
  key: string;        // "tx:123" or "memo:456"
  type: "tx" | "memo";
  value: string;      // 編集可能なテキスト値
};

// ============================================
// ヘルパー
// ============================================

let tempIdCounter = -1;
function nextTempId(): number {
  return tempIdCounter--;
}

function buildLineItems(
  transactions: GroupDetailData["transactions"],
  lineDescriptions: Record<string, string>,
  counterpartyName: string
): { id: number; description: string; period: string; amount: number; taxRate: number }[] {
  return transactions.map((t) => {
    const taxExcludedAmount =
      t.taxType === "tax_excluded" ? t.amount : t.amount - t.taxAmount;
    const description =
      lineDescriptions[String(t.id)] ||
      buildDefaultDescription(t.expenseCategoryName, t.note, counterpartyName);
    return {
      id: t.id,
      description,
      period: formatPeriodRange(t.periodFrom, t.periodTo),
      amount: taxExcludedAmount,
      taxRate: t.taxRate,
    };
  });
}

// ============================================
// ドラッグ&ドロップ用ソータブルアイテム
// ============================================

function SortableOrderItem({
  id,
  type,
  value,
  onChangeValue,
  onDelete,
}: {
  id: string;
  type: "tx" | "memo";
  value: string;
  onChangeValue: (value: string) => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 bg-white rounded border px-2 py-1 text-xs ${
        isDragging ? "shadow-md opacity-90 z-10" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Input
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder={type === "memo" ? "メモ行の内容を入力..." : ""}
        className="flex-1 h-7 text-xs border-0 shadow-none focus-visible:ring-0 px-1"
      />
      {type === "memo" && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-red-400 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================
// コンポーネント
// ============================================

export function InvoiceBuilderTab({ groupId, projectId, onInvoiceCreated, onPdfGenerated, isEditable = true, invoiceDate: invoiceDateProp, paymentDueDate: paymentDueDateProp, onInvoiceDateChange, onPaymentDueDateChange }: InvoiceBuilderTabProps) {
  // データロード状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // サーバーから取得したデータ
  const [data, setData] = useState<GroupDetailData | null>(null);

  // 編集可能フィールド
  const [honorific, setHonorific] = useState("御中");
  const [localInvoiceDate, setLocalInvoiceDate] = useState("");
  const [localPaymentDueDate, setLocalPaymentDueDate] = useState("");
  const [remarks, setRemarks] = useState("");

  // controlled/uncontrolled パターン: 親から props が渡されている場合は親の state を使用
  const invoiceDate = invoiceDateProp ?? localInvoiceDate;
  const paymentDueDate = paymentDueDateProp ?? localPaymentDueDate;

  const setInvoiceDate = (val: string) => {
    onInvoiceDateChange ? onInvoiceDateChange(val) : setLocalInvoiceDate(val);
  };
  const setPaymentDueDate = (val: string) => {
    onPaymentDueDateChange ? onPaymentDueDateChange(val) : setLocalPaymentDueDate(val);
  };
  const [memoLines, setMemoLines] = useState<LocalMemoLine[]>([]);
  const [lineOrder, setLineOrderState] = useState<string[]>([]);
  const [lineDescriptions, setLineDescriptions] = useState<Record<string, string>>({});

  // ============================================
  // データ取得
  // ============================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getInvoiceGroupDetail(groupId) as unknown as GroupDetailData;
      if (!result) return;

      setData(result);
      setHonorific(result.honorific || "御中");
      // ローカルstateに常にDB値をセット（controlledモードでは親のstateが優先されるため上書きしない）
      setLocalInvoiceDate(result.invoiceDate ?? "");
      setLocalPaymentDueDate(result.paymentDueDate ?? "");
      setRemarks(result.remarks ?? "");

      // lineDescriptions初期化
      setLineDescriptions(result.lineDescriptions ?? {});

      // メモ行のローカルstate初期化
      const localMemos: LocalMemoLine[] = (result.memoLines || []).map((ml) => ({
        id: ml.id,
        description: ml.description,
        sortOrder: ml.sortOrder,
        originalDescription: ml.description,
      }));
      setMemoLines(localMemos);

      // lineOrder初期化
      if (result.lineOrder && result.lineOrder.length > 0) {
        setLineOrderState(result.lineOrder);
      } else {
        // デフォルト: 取引のみ順番に
        const defaultOrder = result.transactions.map((t) => `tx:${t.id}`);
        setLineOrderState(defaultOrder);
      }

      // tempIdCounterをリセット
      tempIdCounter = -1;
    } catch (e) {
      console.error("データ取得失敗:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================
  // メモ行操作
  // ============================================

  const handleAddMemoLine = () => {
    const tempId = nextTempId();
    const newMemo: LocalMemoLine = {
      id: tempId,
      description: "",
      sortOrder: memoLines.length,
      isNew: true,
    };
    setMemoLines((prev) => [...prev, newMemo]);
    // lineOrder にも追加
    setLineOrderState((prev) => [...prev, `memo:${tempId}`]);
  };

  const handleUpdateMemoDescription = (id: number, description: string) => {
    setMemoLines((prev) =>
      prev.map((ml) => (ml.id === id ? { ...ml, description } : ml))
    );
  };

  const handleDeleteMemoLine = (id: number) => {
    if (id < 0) {
      // 新規（未保存）のメモ行は直接削除
      setMemoLines((prev) => prev.filter((ml) => ml.id !== id));
    } else {
      // 既存のメモ行は削除フラグを立てる
      setMemoLines((prev) =>
        prev.map((ml) => (ml.id === id ? { ...ml, isDeleted: true } : ml))
      );
    }
    // lineOrder からも削除
    setLineOrderState((prev) => prev.filter((key) => key !== `memo:${id}`));
  };

  // ============================================
  // 並べ替え
  // ============================================

  const orderItems: OrderItem[] = useMemo(() => {
    if (!data) return [];

    const txMap = new Map(data.transactions.map((t) => [t.id, t]));
    const memoMap = new Map(
      memoLines.filter((ml) => !ml.isDeleted).map((ml) => [ml.id, ml])
    );

    return lineOrder
      .map((key) => {
        const [prefix, idStr] = key.split(":");
        const id = Number(idStr);
        if (prefix === "tx") {
          const tx = txMap.get(id);
          if (!tx) return null;
          return {
            key,
            type: "tx" as const,
            value:
              lineDescriptions[String(id)] ||
              buildDefaultDescription(tx.expenseCategoryName, tx.note, data.counterpartyName),
          };
        } else if (prefix === "memo") {
          const ml = memoMap.get(id);
          if (!ml) return null;
          return {
            key,
            type: "memo" as const,
            value: ml.description,
          };
        }
        return null;
      })
      .filter((item): item is OrderItem => item !== null);
  }, [lineOrder, data, memoLines, lineDescriptions]);

  const dndSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLineOrderState((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  // ============================================
  // 保存
  // ============================================

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    try {
      // 1. 基本情報の更新（デフォルト値と同じlineDescriptionsは除去）
      const txMap = new Map(data!.transactions.map((t) => [String(t.id), t]));
      const cleanedDescriptions = Object.fromEntries(
        Object.entries(lineDescriptions).filter(([txId, v]) => {
          if (v.trim() === "") return false;
          const tx = txMap.get(txId);
          if (!tx) return false;
          const defaultVal = buildDefaultDescription(
            tx.expenseCategoryName,
            tx.note,
            data!.counterpartyName
          );
          return v !== defaultVal;
        })
      );
      await updateInvoiceGroup(groupId, {
        honorific,
        remarks: remarks || null,
        invoiceDate: invoiceDate || null,
        paymentDueDate: paymentDueDate || null,
        lineDescriptions: Object.keys(cleanedDescriptions).length > 0 ? cleanedDescriptions : null,
      });

      // 2. メモ行の同期
      // tempID→実IDの対応を追跡
      const idReplacements = new Map<number, number>();

      // 新規メモ行を追加
      const memoLinesToAdd = memoLines.filter((ml) => ml.isNew && !ml.isDeleted);
      for (const ml of memoLinesToAdd) {
        const result = await addMemoLine(groupId, ml.description, ml.sortOrder);
        if (result && typeof result === "object" && "id" in result) {
          const realId = (result as { id: number }).id;
          idReplacements.set(ml.id, realId);
        }
      }

      // 既存メモ行の内容変更を更新
      const memoLinesToUpdate = memoLines.filter(
        (ml) =>
          !ml.isNew &&
          !ml.isDeleted &&
          ml.description !== ml.originalDescription
      );
      for (const ml of memoLinesToUpdate) {
        await updateMemoLine(ml.id, ml.description);
      }

      // 削除されたメモ行
      const memoLineIdsToDelete = memoLines
        .filter((ml) => !ml.isNew && ml.isDeleted)
        .map((ml) => ml.id);
      for (const id of memoLineIdsToDelete) {
        await deleteMemoLine(id);
      }

      // 3. 並び順の保存
      // ローカル変数でtempID→実IDを適用してからDBに保存
      const resolvedLineOrder = lineOrder
        .map((key) => {
          const [prefix, idStr] = key.split(":");
          const id = Number(idStr);
          if (prefix === "memo" && idReplacements.has(id)) {
            return `memo:${idReplacements.get(id)}`;
          }
          return key;
        })
        .filter((key) => {
          const [, idStr] = key.split(":");
          return Number(idStr) > 0;
        });
      await updateLineOrder(groupId, resolvedLineOrder);

      // stateも更新（次回保存時に正しい値を参照するため）
      setLineOrderState(resolvedLineOrder);

      // リロード
      await loadData();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // PDFとして保存
  // ============================================

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      // まず保存を実行（失敗したらPDF生成を中断）
      const saved = await handleSave();
      if (!saved) return;

      // PDF生成
      const result = await generateInvoicePdf(groupId);

      // データリロード
      await loadData();

      // 親コンポーネントに通知
      onInvoiceCreated?.();

      // PDF生成後のアクション選択を親に委譲
      if (result?.pdfPath && onPdfGenerated) {
        onPdfGenerated(result.pdfPath);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "PDF生成中にエラーが発生しました");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ============================================
  // プレビュー用props
  // ============================================

  const previewProps = useMemo(() => {
    if (!data) return null;

    const lineItems = buildLineItems(data.transactions, lineDescriptions, data.counterpartyName);
    const activeMemoLines = memoLines
      .filter((ml) => !ml.isDeleted)
      .map((ml) => ({ id: ml.id, description: ml.description }));

    return {
      operatingCompany: data.operatingCompany,
      counterpartyName: data.counterpartyName,
      honorific,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: invoiceDate || null,
      paymentDueDate: paymentDueDate || null,
      lineItems,
      memoLines: activeMemoLines,
      lineOrder,
      taxSummary: data.taxSummary || {},
      subtotal: data.subtotal ?? 0,
      taxAmount: data.taxAmount ?? 0,
      totalAmount: data.totalAmount ?? 0,
      bankAccount: data.bankAccount,
      remarks: remarks || null,
    };
  }, [data, honorific, invoiceDate, paymentDueDate, memoLines, lineOrder, lineDescriptions, remarks]);

  // ============================================
  // バリデーション
  // ============================================

  const validationErrors = useMemo(() => {
    if (!data) return [];
    const errors: string[] = [];
    if (!data.bankAccount) errors.push("振込先口座が未設定です");
    if (!invoiceDate) errors.push("請求日が未入力です");
    if (!paymentDueDate) errors.push("支払期限が未入力です");
    if (data.transactions.length === 0) errors.push("明細（取引）がありません");
    return errors;
  }, [data, invoiceDate, paymentDueDate]);

  // ============================================
  // ローディング表示
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">読み込み中...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        データの取得に失敗しました
      </div>
    );
  }

  // ============================================
  // レンダリング
  // ============================================

  const isBusy = saving || generatingPdf;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0 overflow-hidden">
      {/* フォーム: モバイルは全幅、LGで30% */}
      <div className="w-full lg:w-[30%] overflow-y-auto space-y-3 lg:pr-2 shrink-0 lg:shrink lg:min-h-0 max-h-[40vh] lg:max-h-none">
        {/* 宛名敬称 */}
        <div>
          <Label className="mb-1 block text-xs font-medium">宛名敬称</Label>
          <RadioGroup
            value={honorific}
            onValueChange={setHonorific}
            className="flex gap-3"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="御中" id="honorific-onchu" />
              <Label htmlFor="honorific-onchu" className="cursor-pointer text-sm">
                御中
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="様" id="honorific-sama" />
              <Label htmlFor="honorific-sama" className="cursor-pointer text-sm">
                様
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* 請求日 + 支払期限 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="invoiceDate" className="mb-1 block text-xs font-medium">
              請求日
            </Label>
            <DatePicker
              id="invoiceDate"
              value={invoiceDate}
              onChange={setInvoiceDate}
              placeholder="日付を選択"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="paymentDueDate" className="mb-1 block text-xs font-medium">
              支払期限
            </Label>
            <DatePicker
              id="paymentDueDate"
              value={paymentDueDate}
              onChange={setPaymentDueDate}
              placeholder="日付を選択"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* 振込先口座 */}
        <div>
          <Label className="mb-1 block text-xs font-medium">振込先口座</Label>
          <div className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5 border">
            {data.bankAccountLabel || "（未設定）"}
          </div>
        </div>

        {/* 明細 */}
        <div>
          <Label className="mb-1 block text-xs font-medium">明細</Label>
          <p className="text-[10px] text-gray-400 mb-1.5">ドラッグで並べ替え、テキストを直接編集できます</p>
          <div className="space-y-1 border rounded p-1.5 bg-gray-50">
            {orderItems.length === 0 && (
              <div className="text-xs text-gray-400 py-2 text-center">
                明細がありません
              </div>
            )}
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderItems.map((item) => item.key)}
                strategy={verticalListSortingStrategy}
              >
                {orderItems.map((item) => {
                  const [, idStr] = item.key.split(":");
                  const id = Number(idStr);
                  return (
                    <SortableOrderItem
                      key={item.key}
                      id={item.key}
                      type={item.type}
                      value={item.value}
                      onChangeValue={(val) => {
                        if (item.type === "tx") {
                          setLineDescriptions((prev) => ({
                            ...prev,
                            [idStr]: val,
                          }));
                        } else {
                          handleUpdateMemoDescription(id, val);
                        }
                      }}
                      onDelete={
                        item.type === "memo"
                          ? () => handleDeleteMemoLine(id)
                          : undefined
                      }
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddMemoLine}
            className="mt-1.5 h-7 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            メモ行を追加
          </Button>
        </div>

        {/* 備考欄 */}
        <div>
          <Label htmlFor="remarks" className="mb-1 block text-xs font-medium">
            備考欄
          </Label>
          <Textarea
            id="remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="備考を入力..."
            className="text-sm"
          />
        </div>

        {/* バリデーションエラー */}
        {validationErrors.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-medium mb-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              PDF作成に必要な情報が不足しています
            </div>
            <ul className="text-[11px] text-amber-600 space-y-0.5 pl-5 list-disc">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 操作ボタン */}
        {isEditable && (
          <div className="flex gap-2 pt-1 pb-2">
            <Button
              onClick={handleSave}
              disabled={isBusy}
              variant="outline"
              size="sm"
              className="flex-1 min-w-0"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1 shrink-0" />
              ) : (
                <Save className="h-4 w-4 mr-1 shrink-0" />
              )}
              <span className="truncate">保存</span>
            </Button>
            <Button
              onClick={handleGeneratePdf}
              disabled={isBusy || validationErrors.length > 0}
              size="sm"
              className="flex-1 min-w-0 bg-blue-600 hover:bg-blue-700"
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1 shrink-0" />
              ) : (
                <FileText className="h-4 w-4 mr-1 shrink-0" />
              )}
              <span className="truncate">PDF作成</span>
            </Button>
          </div>
        )}
      </div>

      {/* プレビュー: モバイルは全幅、LGで70% */}
      <div className="flex-1 overflow-y-auto lg:border-l lg:pl-4 min-w-0 min-h-0">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm pb-2 mb-2 border-b z-10">
          <h3 className="text-xs font-medium text-gray-500">プレビュー</h3>
        </div>
        {previewProps && <InvoicePreview {...previewProps} />}
      </div>
    </div>
  );
}
