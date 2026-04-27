/**
 * 短縮URL機能(/api/internal/shorten-url + /s/[code])で
 * リダイレクト先として許可するドメインのホワイトリスト。
 *
 * 自社ドメイン以外は弾くことで、内部犯行やアカウント乗っ取り時に
 * フィッシングリンクを生成されるリスクを最小化する。
 *
 * ## 許可ドメインの追加方法
 *
 * 配下に新しい自社ドメインを追加する場合は、ALLOWED_HOSTNAMES 配列に
 * ホスト名(プロトコルなし)を追加する。サブドメインは個別に列挙すること
 * (例: `bbs.support-hubs.com` と `stg-bbs.support-hubs.com` を別々に書く)。
 *
 * ## 動作
 *
 * - URL のホスト部分が ALLOWED_HOSTNAMES に **完全一致** すれば true
 * - ホスト部分が ALLOWED_HOSTNAMES のいずれにもマッチしなければ false
 * - http/https 以外のスキーム (javascript:, data: 等) は false
 * - 不正な URL は false
 */

const ALLOWED_HOSTNAMES = new Set<string>([
  // ステラインターナショナル本体ドメイン
  "portal.stella-international.co.jp",
  "stg-portal.stella-international.co.jp",
  "crm.stella-international.co.jp",
  // 補助金事業 (BBS / ベンダー / 貸金業社 / 顧客フォーム)
  "bbs.support-hubs.com",
  "vendor.support-hubs.com",
  "loan.support-hubs.com",
  "customer.support-hubs.com",
  "stg-bbs.support-hubs.com",
  "stg-vendor.support-hubs.com",
  "stg-loan.support-hubs.com",
  "stg-customer.support-hubs.com",
  // 公的制度教育推進協会(SLP 顧客向けドメイン)
  "customer.koutekiseido-japan.com",
  "stg-customer.koutekiseido-japan.com",
]);

export function isUrlAllowedForShortening(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  // http/https 以外は不可(javascript: data: ftp: etc.)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  return ALLOWED_HOSTNAMES.has(parsed.hostname);
}

/** テスト/デバッグ用に許可ドメイン一覧を返す */
export function getAllowedShorteningHostnames(): string[] {
  return Array.from(ALLOWED_HOSTNAMES);
}
