import type { ReactNode } from "react";
import type { EditableCellOption } from "@/components/editable-cell";
import type { ActionResult } from "@/lib/action-result";

export type ColumnDef = {
  key: string;
  header: string;
  type?: "text" | "number" | "date" | "datetime" | "month" | "boolean" | "textarea" | "select" | "multiselect" | "password";
  editable?: boolean;
  editableOnCreate?: boolean; // 新規作成時のみ編集可能（未指定の場合はeditable準拠）
  editableOnUpdate?: boolean; // 編集時のみ編集可能（未指定の場合はeditable準拠）
  options?: { value: string; label: string }[];
  dynamicOptionsKey?: string; // 動的選択肢を取得するためのキー（dependsOnフィールドの値をキーとして使用）
  dependsOn?: string; // このフィールドの値に依存して選択肢を変更する
  dependsOnPlaceholder?: string; // dependsOnフィールド未選択時のプレースホルダー
  required?: boolean;
  searchable?: boolean; // selectタイプで検索可能にする
  filterable?: boolean; // フィルタリング対象にするか（デフォルトtrue）
  simpleMode?: boolean; // 簡易入力モードで表示するかどうか
  hidden?: boolean; // テーブル一覧で非表示にするか
  inlineEditable?: boolean; // インライン編集可能にするか（enableInlineEdit時に使用）
  currency?: boolean; // 通貨フォーマット（¥#,##0）で表示・入力
  defaultValue?: unknown; // 新規追加時のデフォルト値
  visibleWhen?: { field: string; value: unknown }; // フォームでの条件付き表示（指定フィールドが指定値の時のみ表示）
  hiddenWhen?: { field: string; value: unknown }; // フォームでの条件付き非表示（指定フィールドが指定値の時に非表示）
  width?: number; // 列幅の指定（px）— TableHead/TableCellにstyleで適用（1を指定すると内容に合わせた最小幅）
  cellClassName?: string; // セルに追加するクラス名
};

// カスタムアクションの定義
export type CustomAction = {
  icon: ReactNode;
  label: string;
  onClick: (item: Record<string, unknown>) => void;
  variant?: "default" | "destructive";
};

// カスタムレンダラーの定義
export type CustomRenderers = {
  [key: string]: (value: unknown, row: Record<string, unknown>) => ReactNode;
};

// カスタムフォームフィールドの定義
export type CustomFormField = {
  render: (
    value: unknown,
    onChange: (value: unknown) => void,
    formData: Record<string, unknown>,
    setFormData: (data: Record<string, unknown>) => void
  ) => ReactNode;
};

export type CustomFormFields = {
  [key: string]: CustomFormField;
};

// 動的選択肢のコンテキスト
export type DynamicOptionsMap = {
  [optionsKey: string]: Record<string, { value: string; label: string }[]>;
};

// インライン編集用の設定
export type InlineEditConfig = {
  // インライン編集対象のカラムキーリスト（指定しない場合はinlineEditable=trueのカラムすべて）
  columns?: string[];
  // セルクリック時のカスタムハンドラ（ステージセルクリックでモーダルを開く等）
  onCellClick?: (row: Record<string, unknown>, columnKey: string) => boolean | void;
  // 動的に選択肢を取得する関数（row情報から選択肢を決定する場合）
  getOptions?: (row: Record<string, unknown>, columnKey: string) => EditableCellOption[];
  // 編集可能かどうかを動的に判定する関数
  isEditable?: (row: Record<string, unknown>, columnKey: string) => boolean;
  // 表示用カラムから編集用カラムへのマッピング（例: leadSourceName -> leadSourceId）
  displayToEditMapping?: Record<string, string>;
};

export type CrudTableProps = {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  emptyMessage?: string;
  // ActionResult を返す新形式・void を返すレガシー形式の両方に対応。
  // 戻り値が ActionResult 形式なら crud-table 内部の callAction が自動的に
  // ok:false を検知して日本語エラーを toast 表示する。
  onAdd?: (data: Record<string, unknown>) => Promise<void | ActionResult<unknown>>;
  onUpdate?: (id: number, data: Record<string, unknown>) => Promise<void | ActionResult<unknown>>;
  onDelete?: (id: number) => Promise<void | ActionResult<unknown>>;
  title?: string;
  addButtonLabel?: string; // 追加ボタンのラベル
  enableInputModeToggle?: boolean; // 簡易/詳細入力モード切り替えを有効にする
  customActions?: CustomAction[]; // カスタムアクションボタン
  customRenderers?: CustomRenderers; // カスタムセルレンダラー
  customFormFields?: CustomFormFields; // カスタムフォームフィールド
  dynamicOptions?: DynamicOptionsMap; // 動的選択肢（dependsOnフィールドの値に応じて選択肢を変更）
  // 並び替え機能
  sortableItems?: import("@/components/sortable-list-modal").SortableItem[]; // 並び替え用のアイテムリスト
  onReorder?: (orderedIds: number[]) => Promise<void>; // 並び替え完了時のコールバック
  sortableGrouped?: boolean; // グループ内並び替えモード（顧客種別など）
  customAddButton?: ReactNode; // カスタム追加ボタン（onAddの代わりにカスタムの追加処理を行う場合）
  // インライン編集機能
  enableInlineEdit?: boolean; // インライン編集を有効にする
  skipInlineConfirm?: boolean; // インライン編集時の確認ダイアログをスキップする
  inlineEditConfig?: InlineEditConfig; // インライン編集の設定
  // フォームフィールド変更時のコールバック（企業選択→日付自動計算など）
  onFieldChange?: (fieldKey: string, newValue: unknown, formData: Record<string, unknown>, setFormData: (data: Record<string, unknown>) => void) => void;
  // インライン編集時の警告メッセージ（確認ダイアログに表示）
  updateWarningMessage?: string;
  // 変更履歴管理対象フィールド（メモ必須の確認ダイアログを表示）
  changeTrackedFields?: { key: string; displayName: string }[];
  // 削除ダイアログオープン時に呼ばれるコールバック（関連データ件数表示など）
  onDeletePrepare?: (id: number) => Promise<ReactNode | null>;
  // 行単位で削除を無効にする（trueを返すと削除ボタン非表示）
  isDeleteDisabled?: (item: Record<string, unknown>) => boolean;
  // 行単位で編集を無効にする（trueを返すと編集ボタン非表示）
  isEditDisabled?: (item: Record<string, unknown>) => boolean;
  // 左側から固定する列数（可視列のみカウント）
  stickyLeftCount?: number;
  // 行ごとのカスタムクラス名
  rowClassName?: (item: Record<string, unknown>) => string | undefined;
  // カスタムヘッダーレンダラー（ヘッダーセルの中身をカスタマイズ）
  customHeaderRenderers?: Record<string, () => ReactNode>;
  // 行グループ化（rowSpan）: 同じgroupByKeyの値を持つ連続行をグループ化し、
  // groupedColumnsで指定した列をrowSpanで結合する
  groupByKey?: string;
  groupedColumns?: string[];
};
