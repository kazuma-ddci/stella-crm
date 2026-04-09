/**
 * プロライン Excel エクスポートの「姓」列に「姓 名」が結合された値が
 * 入ってくるため、姓と名を分離する正規化ユーティリティ。
 *
 * プロラインの実際の出力パターン（実機で確認済み）:
 *   1. 姓="田中", 名="太郎"  → sei="田中 太郎", mei="太郎"
 *   2. 姓="田中", 名=""      → sei="田中",      mei=""
 *   3. 姓="",     名="太郎"  → sei="",          mei="太郎"
 *
 * 上記から、Excel の「姓」列は実際には「姓 名」（半角スペース区切り）の
 * 結合値が入る一方、「名」列は「名」のみが正しく入っていることがわかる。
 *
 * 正規化ロジック:
 *   - sei が " " + mei で終わっている → 末尾の " " + mei を除去して sei 部分を抽出
 *   - sei が "　" + mei（全角スペース）で終わっている → 同様に除去
 *   - sei == mei → 「姓」列にも「名」と同じ値が入っているケース、sei を null に
 *   - それ以外（既に正しく分離されている） → そのまま返す
 */
export function normalizeSeiMei(
  sei: string | null | undefined,
  mei: string | null | undefined,
): { sei: string | null; mei: string | null } {
  const seiVal = sei && sei.trim() !== "" ? sei.trim() : null;
  const meiVal = mei && mei.trim() !== "" ? mei.trim() : null;

  // ケース3: sei が空、mei のみ
  if (!seiVal) {
    return { sei: null, mei: meiVal };
  }

  // ケース2: mei が空、sei のみ
  if (!meiVal) {
    return { sei: seiVal, mei: null };
  }

  // ケース1: sei が " " + mei または "　" + mei で終わっている場合は
  // 末尾の mei 部分を除去して sei を抽出する
  for (const sep of [" ", "　"]) {
    const suffix = sep + meiVal;
    if (seiVal.endsWith(suffix)) {
      const cleanSei = seiVal.slice(0, seiVal.length - suffix.length).trim();
      return {
        sei: cleanSei !== "" ? cleanSei : null,
        mei: meiVal,
      };
    }
  }

  // sei と mei が完全一致している場合 → 「姓」列にも「名」と同じ値が
  // 入ってしまっているケース。sei を null にする
  if (seiVal === meiVal) {
    return { sei: null, mei: meiVal };
  }

  // 既に正しく分離されている、または不明な形式 → そのまま返す
  return { sei: seiVal, mei: meiVal };
}
