/**
 * Kouteki Design Components
 * --------------------------------
 * 一般社団法人 公的制度教育推進協会 (SLP) ブランドの UI コンポーネント群。
 *
 * 役割:
 * - 公開フォーム（`/form/slp-*`）専用の最小限のデザイン部品を提供する
 * - フォーム以外のサイト構造（ヘッダー / フッター / ヒーローなど）は持たない
 * - 補助金ポータル (`src/components/hojo-portal.tsx`) と同じ思想で、
 *   「色味とフォントとカード/ボタンスタイル」だけを揃えるためのもの
 *
 * カラー:
 * - メイン青: from-[#1e3a8a] via-[#1d4ed8] to-[#3b82f6]
 * - text-blue-700 / bg-blue-600 系
 *
 * 詳細は `src/components/kouteki/README.md` を参照。
 */

// レイアウト
export {
  KoutekiPageShell,
  KoutekiContainer,
  KoutekiLogoMark,
  KOUTEKI_GRADIENT,
} from "./page-shell";

// セクション見出し
export { KoutekiSectionHeader } from "./section-header";

// カード
export {
  KoutekiCard,
  KoutekiCardHeader,
  KoutekiCardTitle,
  KoutekiCardDescription,
  KoutekiCardContent,
  KoutekiCardFooter,
} from "./kouteki-card";

// ボタン
export {
  KoutekiButton,
  koutekiButtonVariants,
  type KoutekiButtonProps,
} from "./kouteki-button";

// フォーム要素
export { KoutekiInput, type KoutekiInputProps } from "./kouteki-input";
export { KoutekiTextarea, type KoutekiTextareaProps } from "./kouteki-textarea";
export { KoutekiSelect, type KoutekiSelectProps } from "./kouteki-select";
export { KoutekiCheckbox, type KoutekiCheckboxProps } from "./kouteki-checkbox";
export { KoutekiFormField, KoutekiFormStack } from "./form-field";
