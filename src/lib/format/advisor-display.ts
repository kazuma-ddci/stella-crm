/**
 * 顧問の区分表示フォーマット
 *
 * @see docs/specs/SPEC-STP-001.md
 *
 * 仕様:
 * - 常に `顧問（件数 / 金額）` の形式で統一
 * - 未入力の項目は `-` で表示
 * - 括弧は全角 `（` `）`
 * - 区切りは ` / `（半角スペース + スラッシュ + 半角スペース）
 */

/**
 * 金額をカンマ区切り円表示にフォーマット
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * 顧問の区分表示をフォーマット
 *
 * @param minimumCases - 最低件数（nullは未入力）
 * @param monthlyFee - 月額費用（nullは未入力）
 * @returns フォーマットされた表示文字列
 *
 * @example
 * formatAdvisorDisplay(10, 100000)  // => "顧問（10件 / ¥100,000）"
 * formatAdvisorDisplay(10, null)    // => "顧問（10件 / -）"
 * formatAdvisorDisplay(null, 100000) // => "顧問（- / ¥100,000）"
 * formatAdvisorDisplay(null, null)  // => "顧問（- / -）"
 */
export function formatAdvisorDisplay(
  minimumCases: number | null | undefined,
  monthlyFee: number | null | undefined
): string {
  const casesDisplay =
    minimumCases !== null && minimumCases !== undefined
      ? `${minimumCases}件`
      : "-";

  const feeDisplay =
    monthlyFee !== null && monthlyFee !== undefined
      ? formatCurrency(monthlyFee)
      : "-";

  return `顧問（${casesDisplay} / ${feeDisplay}）`;
}
