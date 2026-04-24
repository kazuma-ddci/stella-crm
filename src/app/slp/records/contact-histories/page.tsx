import { redirect } from "next/navigation";

/**
 * SLP 接触履歴 旧ページ。
 * V2 へ切替済みのため /slp/records/contact-histories-v2 へ redirect。
 */
export default function DeprecatedSlpContactHistoriesPage() {
  redirect("/slp/records/contact-histories-v2");
}
