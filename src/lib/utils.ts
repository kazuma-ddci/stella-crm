import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * DateオブジェクトをローカルタイムゾーンでYYYY-MM-DD形式に変換する。
 * toISOString()はUTC変換するためJSTで日付が1日ずれる問題を回避する。
 */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * 企業名を正規化して比較用文字列を生成する。
 * - 全角スペース・半角スペースを除去
 * - 「株式会社」「(株)」「（株）」を統一（除去）
 * - 「有限会社」「(有)」「（有）」を統一（除去）
 * - 「合同会社」「(同)」「（同）」を統一（除去）
 * - 全角英数字を半角に変換
 * - 大文字を小文字に変換
 */
export function normalizeCompanyName(name: string): string {
  let normalized = name;

  // 法人格を除去
  normalized = normalized.replace(/株式会社|（株）|\(株\)/g, "");
  normalized = normalized.replace(/有限会社|（有）|\(有\)/g, "");
  normalized = normalized.replace(/合同会社|（同）|\(同\)/g, "");

  // スペース除去
  normalized = normalized.replace(/[\s\u3000]+/g, "");

  // 全角英数字を半角に変換
  normalized = normalized.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );

  // 小文字化
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * 法人番号の正規化。
 * - 全角数字→半角数字
 * - ハイフン・スペース（全角/半角）・その他非数字を除去
 */
export function normalizeCorporateNumber(input: string): string {
  // 全角数字→半角数字
  let result = input.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
  // 非数字を除去（ハイフン、スペース等）
  result = result.replace(/[^0-9]/g, "");
  return result;
}

/**
 * 法人番号のチェックデジットを検証する。
 * 国税庁公式アルゴリズム:
 * 法人番号 = x + P₁P₂P₃...P₁₂ (x=チェックデジット, P₁〜P₁₂=基礎番号12桁)
 * x = 9 - ( Σ(i=1..12) Pᵢ × Qᵢ ) mod 9
 * ただし Qᵢ = (i が奇数なら 1, 偶数なら 2)  ※ i は最下位(P₁₂)から数える
 */
export function validateCorporateNumberCheckDigit(corporateNumber: string): boolean {
  if (corporateNumber.length !== 13) return false;

  const digits = corporateNumber.split("").map(Number);
  const checkDigit = digits[0];
  const baseDigits = digits.slice(1); // P₁〜P₁₂（左から右）

  // 最下位(P₁₂)から数えて、奇数桁(i=1,3,5...)の係数は1、偶数桁(i=2,4,6...)の係数は2
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const posFromRight = 12 - i; // P₁₂からの位置（1始まり）
    const weight = posFromRight % 2 === 1 ? 1 : 2;
    sum += baseDigits[i] * weight;
  }

  const expected = 9 - (sum % 9);
  return checkDigit === expected;
}

/**
 * 法人番号の統合バリデーション。
 * 正規化 + 桁数チェック + チェックデジット検証を行う。
 */
export function validateCorporateNumber(input: string | null | undefined): {
  valid: boolean;
  normalized: string | null;
  error?: string;
} {
  // 空/null → valid（NULL許容）
  if (!input || input.trim() === "") {
    return { valid: true, normalized: null };
  }

  const normalized = normalizeCorporateNumber(input);

  // 全ゼロチェック
  if (/^0+$/.test(normalized)) {
    return { valid: false, normalized, error: "法人番号が不正です" };
  }

  // 12桁 → 会社法人等番号の誤入力
  if (normalized.length === 12) {
    return {
      valid: false,
      normalized,
      error: "会社法人等番号（12桁）ではなく法人番号（13桁）を入力してください",
    };
  }

  // 13桁以外
  if (normalized.length !== 13) {
    return {
      valid: false,
      normalized,
      error: "法人番号は13桁の数字で入力してください",
    };
  }

  // チェックデジット検証
  if (!validateCorporateNumberCheckDigit(normalized)) {
    return {
      valid: false,
      normalized,
      error: "法人番号のチェックデジットが不正です。番号を確認してください",
    };
  }

  return { valid: true, normalized };
}
