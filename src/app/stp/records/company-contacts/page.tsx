import { redirect } from "next/navigation";

/**
 * STP 企業接触履歴 旧ページ。
 * V2 へ切替済みのため /stp/records/contact-histories-v2 へ redirect。
 * (V2 では企業と代理店が同じ一覧に表示される。絞り込みは今後実装予定)
 */
export default function DeprecatedStpCompanyContactsPage() {
  redirect("/stp/records/contact-histories-v2");
}
