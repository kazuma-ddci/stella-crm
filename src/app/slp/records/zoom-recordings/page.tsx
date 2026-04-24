import { redirect } from "next/navigation";

/**
 * 旧 Zoom 商談録画ページは V2 統合版 /slp/records/meeting-records に移行しました。
 * 旧 URL へのアクセスは V2 ページにリダイレクトします。
 */
export default function LegacySlpZoomRecordingsPage() {
  redirect("/slp/records/meeting-records");
}
