/**
 * 請求書明細の品目・摘要テキスト生成ユーティリティ
 */

/**
 * デフォルトの品目テキストを生成する
 *
 * ロジック:
 * - noteがある場合: noteから取引先名（counterpartyName）を除去した残りを使用
 * - noteがない場合: category名をそのまま使用
 *
 * 例:
 *   note="日本テクノサービス 月額費用", category="月額売上" → "月額費用"
 *   note="日本テクノサービス 成果報酬 (田中太郎)", category="成果売上" → "成果報酬 (田中太郎)"
 *   note=null, category="月額売上" → "月額売上"
 */
export function buildDefaultDescription(
  categoryName: string,
  note: string | null,
  counterpartyName?: string
): string {
  if (!note) return categoryName;

  if (counterpartyName) {
    // noteの先頭から取引先名を除去
    const trimmed = note.startsWith(counterpartyName)
      ? note.slice(counterpartyName.length).trimStart()
      : note;
    return trimmed || categoryName;
  }

  return note;
}

/**
 * 日付範囲を表示用文字列にフォーマットする
 *
 * - periodFrom === periodTo の場合: "2026-01-31" のみ
 * - 異なる場合: "2026-01-01 〜 2026-01-31"
 */
export function formatPeriodRange(
  periodFrom: string,
  periodTo: string
): string {
  if (periodFrom === periodTo) return periodFrom;
  return `${periodFrom} 〜 ${periodTo}`;
}
