// 補助金RPA実行で扱う3種類の資料の共通定義。
// docType は HojoApplicationSupportDocument.docType カラムに格納される値と一致。

export const HOJO_DOC_TYPES = {
  trainingReport: "training_report",
  supportApplication: "support_application",
  businessPlan: "business_plan",
} as const;

export type RpaDocKey = keyof typeof HOJO_DOC_TYPES;

export const RPA_DOC_ITEMS: ReadonlyArray<{ key: RpaDocKey; label: string }> = [
  { key: "trainingReport", label: "研修終了報告書" },
  { key: "supportApplication", label: "支援制度申請書" },
  { key: "businessPlan", label: "事業計画書" },
];

export const RPA_DOC_LABELS: Record<RpaDocKey, string> = Object.fromEntries(
  RPA_DOC_ITEMS.map((i) => [i.key, i.label]),
) as Record<RpaDocKey, string>;
