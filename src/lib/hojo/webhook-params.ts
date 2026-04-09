/**
 * プロラインWebhookのパラメータをDBフィールドにマッピングする共通ユーティリティ
 *
 * DBに存在するフィールドのうち、プロラインの変数で取得できるもののみ対応。
 * WebhookのURLに含めるパラメータを増減してもコード変更不要。
 */

import { normalizeSeiMei } from "@/lib/hojo/normalize-sei-mei";

function toNullIfEmpty(val: string | null): string | null {
  if (!val || val.trim() === "") return null;
  return val.trim();
}

/**
 * プロラインのクエリパラメータ名 → DBフィールド名のマッピング
 *
 * DBにあってプロライン変数で取得できるもの:
 *   snsname, password, email, sei, mei, nickname, phone,
 *   postcode, address1〜3, nenrei, nendai, seibetu, free1〜6
 *
 * DBにあるがプロライン変数では取得できないもの（Excel同期でのみ取得）:
 *   emailLine, emailRenkei, emailLine2, activeStatus, lastActivityDate, scenarioPos1〜5
 */
const PARAM_TO_FIELD: Record<string, string> = {
  snsname: "snsname",
  password: "password",
  email: "email",
  sei: "sei",
  mei: "mei",
  nickname: "nickname",
  phone: "phone",
  postcode: "postcode",
  address1: "address1",
  address2: "address2",
  address3: "address3",
  nenrei: "nenrei",
  nendai: "nendai",
  seibetu: "seibetu",
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
 * 対応しないパラメータ（uid, secret, followed 等）は個別処理またはスキップ。
 */
export function extractWebhookData(searchParams: URLSearchParams): {
  data: Record<string, string | null>;
  friendAddedDate: Date | null;
} {
  const data: Record<string, string | null> = {};

  for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
    const value = searchParams.get(param);
    if (value !== null) {
      data[field] = toNullIfEmpty(value);
    }
  }

  // 姓名の正規化（プロライン側で「姓」に「姓 名」が結合された値が
  // 入ってくるケースに対応）
  if ("sei" in data || "mei" in data) {
    const { sei, mei } = normalizeSeiMei(data.sei ?? null, data.mei ?? null);
    if ("sei" in data) data.sei = sei;
    if ("mei" in data) data.mei = mei;
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
