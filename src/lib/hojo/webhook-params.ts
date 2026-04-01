/**
 * プロラインWebhookのパラメータをDBフィールドにマッピングする共通ユーティリティ
 *
 * プロラインから送られるクエリパラメータ名 → DBカラム名の対応表。
 * WebhookのURLに含めるパラメータを増減しても、コード変更なしで対応できる。
 * DBに対応するカラムがないパラメータは自動で無視される。
 */

function toNullIfEmpty(val: string | null): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

/**
 * プロラインのクエリパラメータ名 → DBフィールド名のマッピング
 * 左: URLクエリパラメータ名（プロラインの変数名）
 * 右: HojoLineFriend系モデルのフィールド名
 */
const PARAM_TO_FIELD: Record<string, string> = {
  // ユーザー基本情報
  snsname: "snsname",
  sei: "sei",
  mei: "mei",
  nickname: "nickname",
  email: "email",
  e: "email",         // 短縮形も対応
  phone: "phone",
  postcode: "postcode",
  address1: "address1",
  address2: "address2",
  address3: "address3",
  nenrei: "nenrei",
  nendai: "nendai",
  seibetu: "seibetu",
  // 認証情報
  passcode: "password",  // プロラインのパスコード → DBのpasswordフィールド
  password: "password",  // プロラインのパスワード → DBのpasswordフィールド
  // フリー項目
  free1: "free1",
  free2: "free2",
  free3: "free3",
  free4: "free4",
  free5: "free5",
  free6: "free6",
};

/**
 * URLSearchParams からDBに保存するデータオブジェクトを生成
 * 送られてきたパラメータのうち、DBフィールドに対応するものだけを抽出する。
 * 対応しないパラメータ（uid, secret, snsnamasan, linenamasan 等）は自動で無視。
 */
export function extractWebhookData(searchParams: URLSearchParams): {
  data: Record<string, string | null>;
  friendAddedDate: Date | null;
} {
  const data: Record<string, string | null> = {};

  for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
    const value = searchParams.get(param);
    if (value !== null) {
      // 同じフィールドに複数パラメータがマッピングされている場合（e と email）、
      // 値があるもの優先（既に値が入っていたら上書きしない）
      if (!(field in data) || data[field] === null) {
        data[field] = toNullIfEmpty(value);
      }
    }
  }

  // followed（友だち追加日）は日付として処理
  let friendAddedDate: Date | null = null;
  const followed = searchParams.get("followed");
  if (followed) {
    const parsed = new Date(followed);
    if (!isNaN(parsed.getTime())) {
      friendAddedDate = parsed;
    }
  }

  return { data, friendAddedDate };
}
