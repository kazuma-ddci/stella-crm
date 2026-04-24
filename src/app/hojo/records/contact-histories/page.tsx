import { redirect } from "next/navigation";

/**
 * HOJO 接触履歴 旧ページ。
 * V2 へ切替済みのため、/hojo/records/contact-histories-v2 へ redirect する。
 * 旧テーブルのデータはそのまま残っているが、参照したい場合は DB から直接確認。
 *
 * 将来的な削除タイミング:
 *   - 旧テーブル (hojo_contact_histories) 削除と同時に、このルート自体も削除
 */
export default function DeprecatedHojoContactHistoriesPage() {
  redirect("/hojo/records/contact-histories-v2");
}
