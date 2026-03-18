import { prisma } from "@/lib/prisma";
import { MembersTable } from "./members-table";

function formatDateTimeMinute(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export default async function SlpMembersPage() {
  const members = await prisma.slpMember.findMany({
    where: { deletedAt: null },
    include: { referrer: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });

  // UID一覧からLINE友達のNo.（id）をまとめて取得
  const uids = members.map((m) => m.uid);
  const lineFriends = await prisma.slpLineFriend.findMany({
    where: { uid: { in: uids }, deletedAt: null },
    select: { uid: true, id: true },
  });
  const lineFriendIdMap = new Map(lineFriends.map((lf) => [lf.uid, lf.id]));

  const data = members.map((m) => ({
    id: m.id,
    lineNo: lineFriendIdMap.get(m.uid) ?? null,
    name: m.name,
    email: m.email,
    status: m.status,
    contractSentDate: formatDateTimeMinute(m.contractSentDate),
    contractSignedDate: formatDateTimeMinute(m.contractSignedDate),
    position: m.position,
    company: m.company,
    memberCategory: m.memberCategory,
    lineName: m.lineName,
    uid: m.uid,
    phone: m.phone,
    address: m.address,
    referrerUid: m.referrerUid,
    referrerDisplay: m.referrer ? `${m.referrer.id} ${m.referrer.name}` : null,
    note: m.note,
    memo: m.memo,
    documentId: m.documentId,
    cloudsignUrl: m.cloudsignUrl,
    reminderCount: m.reminderCount,
    formSubmittedAt: formatDateTimeMinute(m.formSubmittedAt),
    lastReminderSentAt: formatDateTimeMinute(m.lastReminderSentAt),
    emailChangeCount: m.emailChangeCount,
    resubmitted: m.resubmitted,
  }));

  const memberOptions = members.map((m) => ({
    value: m.uid,
    label: `${m.id} ${m.name}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">組合員名簿</h1>
      <MembersTable data={data} memberOptions={memberOptions} />
    </div>
  );
}
