import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { getMeetingRecordDetail } from "@/lib/contact-history-v2/meeting-records/loaders";
import { MeetingRecordDetailTabs } from "@/components/meeting-records/detail-tabs";

type Props = { params: Promise<{ id: string }> };

export default async function StpMeetingRecordDetailPage({ params }: Props) {
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const detail = await getMeetingRecordDetail(id, "stp");
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/stp/records/meeting-records"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        一覧に戻る
      </Link>
      <MeetingRecordDetailTabs detail={detail} />
    </div>
  );
}
