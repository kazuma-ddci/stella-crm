import { redirect } from "next/navigation";

/**
 * STP 代理店接触履歴 旧ページ。
 * V2 へ切替済みのため /stp/records/contact-histories-v2 へ redirect。
 */
export default function DeprecatedStpAgentContactsPage() {
  redirect("/stp/records/contact-histories-v2");
}
