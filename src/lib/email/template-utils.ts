/**
 * テンプレート変数を展開する（クライアント/サーバー共用）
 *
 * 対応変数:
 * - {{法人名}} - operatingCompany.companyName
 * - {{取引先名}} - counterparty.name
 * - {{担当者名}} - recipient名
 * - {{年月}} - YYYY年MM月
 * - {{合計金額}} - 合計額のフォーマット
 * - {{支払期限}} - paymentDueDate のフォーマット
 * - {{指定PDF名}} - pdfFileName
 * - {{受信メールアドレス}} - recipient email
 *
 * 未定義の変数はそのまま残す
 */
export function expandTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(.+?)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return trimmedKey in variables ? variables[trimmedKey] : match;
  });
}
