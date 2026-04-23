import { notFound } from "next/navigation";
import { loadSlpContactHistoryV2Masters } from "../../load-masters";
import { getContactHistoryV2ById } from "@/lib/contact-history-v2/loaders";
import {
  ContactHistoryV2Form,
  type ContactHistoryFormInitial,
  type ExistingMeetingInfo,
} from "../../contact-history-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditSlpContactHistoryV2Page({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const [masters, history] = await Promise.all([
    loadSlpContactHistoryV2Masters(),
    getContactHistoryV2ById(id, { projectCode: "slp" }),
  ]);
  if (!masters || !history) notFound();

  // フォームの initial を構築
  const hostStaff = history.staffParticipants.find((p) => p.isHost);

  const initial: ContactHistoryFormInitial = {
    id: history.id,
    title: history.title,
    status: history.status,
    scheduledStartAt: history.scheduledStartAt.toISOString(),
    scheduledEndAt: history.scheduledEndAt?.toISOString() ?? null,
    contactMethodId: history.contactMethodId,
    contactCategoryId: history.contactCategoryId,
    meetingMinutes: history.meetingMinutes,
    note: history.note,
    customers: history.customerParticipants.map((cp) => ({
      targetType: cp.targetType,
      targetId: cp.targetId,
      attendees: cp.attendees.map((a) => ({ name: a.name, title: a.title })),
    })),
    staffIds: history.staffParticipants.map((p) => p.staffId),
    hostStaffId: hostStaff?.staffId ?? null,
  };

  const existingMeetings: ExistingMeetingInfo[] = history.meetings.map((m) => ({
    id: m.id,
    provider: m.provider,
    label: m.label,
    isPrimary: m.isPrimary,
    state: m.state,
    joinUrl: m.joinUrl,
    hostStaffName: m.hostStaff?.name ?? null,
    hasRecord: m.record !== null,
    hasAiSummary: m.record !== null && m.record.aiSummary !== null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">接触履歴を編集（V2）</h1>
        <p className="mt-1 text-sm text-gray-600">ID: {history.id}</p>
      </div>

      <ContactHistoryV2Form
        mode="edit"
        masters={masters}
        initial={initial}
        existingMeetings={existingMeetings}
      />
    </div>
  );
}
