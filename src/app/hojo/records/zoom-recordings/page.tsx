import { redirect } from "next/navigation";

/**
 * 旧 Zoom 商談録画ページは V2 統合版 /hojo/records/meeting-records に移行しました。
 * 旧 URL へのアクセスは V2 ページにリダイレクトします。
 */
export default function LegacyHojoZoomRecordingsPage() {
  redirect("/hojo/records/meeting-records");
}
