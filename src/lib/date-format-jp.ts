/**
 * 日付を JST の「2026年4月1日」形式でフォーマットする。
 * 通知テンプレ（Form15 等）に組み込む文字列として利用。
 */
export function formatJpDate(date: Date | null | undefined): string {
  if (!date) return "";
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return `${y}年${m}月${d}日`;
}
