// 補助金 公開フォーム（顧客回答用）のベースURLを返す。
// 環境変数 NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN が設定されていればそれを使用、
// 未設定（ローカル等）ならクライアント側で window.origin にフォールバック。
export function getHojoCustomerOrigin(): string {
  if (process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN) {
    return process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}
