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
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true, autoSendContract: true },
  });

  const [members, contractStatuses, contractTypes] = await Promise.all([
    prisma.slpMember.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    }),
    prisma.masterContractStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    slpProject
      ? prisma.contractType.findMany({
          where: { projectId: slpProject.id, isActive: true },
          orderBy: { displayOrder: "asc" },
        })
      : [],
  ]);

  // UID一覧からLINE友達のNo.（id）とfree1（紹介者UID）をまとめて取得
  const uids = members.map((m) => m.uid);
  const lineFriends = await prisma.slpLineFriend.findMany({
    where: { uid: { in: uids }, deletedAt: null },
    select: { uid: true, id: true, free1: true },
  });
  const lineFriendIdMap = new Map(lineFriends.map((lf) => [lf.uid, lf.id]));
  const lineFriendFree1Map = new Map(lineFriends.map((lf) => [lf.uid, lf.free1]));
  // LINE紐付け済みかどうかの判定用（SlpLineFriendが存在するかどうか）
  const lineFriendExistSet = new Set(lineFriends.map((lf) => lf.uid));

  // free1（紹介者UID）からメンバー情報を引くためのマップ
  const memberByUidMap = new Map(members.map((m) => [m.uid, m]));

  const data = members.map((m) => {
    const lineLinked = lineFriendExistSet.has(m.uid);
    const currentFree1 = lineFriendFree1Map.get(m.uid) ?? null;
    // 紹介者未通知判定:
    //   - LINE紐付き済み
    //   - free1（紹介者UID）が存在する
    //   - 現在のfree1 と form5NotifiedReferrerUid が一致しない
    //   - 締結済み（締結前は通知不要）
    const referrerUnnotified =
      lineLinked &&
      !!currentFree1 &&
      m.form5NotifiedReferrerUid !== currentFree1 &&
      m.status === "組合員契約書締結";

    return {
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
      referrerUid: currentFree1 || m.referrerUid || null,
      referrerDisplay: (() => {
        const referrer = currentFree1 ? memberByUidMap.get(currentFree1) : null;
        return referrer ? `${referrer.id} ${referrer.name}` : null;
      })(),
      note: m.note,
      memo: m.memo,
      documentId: m.documentId,
      cloudsignUrl: m.cloudsignUrl,
      reminderCount: m.reminderCount,
      formSubmittedAt: formatDateTimeMinute(m.formSubmittedAt),
      lastReminderSentAt: formatDateTimeMinute(m.lastReminderSentAt),
      emailChangeCount: m.emailChangeCount,
      resubmitted: m.resubmitted,
      watermarkCode: m.watermarkCode,
      form5NotifyCount: m.form5NotifyCount,
      form5NotifiedReferrerUid: m.form5NotifiedReferrerUid,
      lineLinked,
      referrerUnnotified,
      cloudsignBounced: m.cloudsignBounced,
      cloudsignBouncedAt: formatDateTimeMinute(m.cloudsignBouncedAt),
      cloudsignBouncedEmail: m.cloudsignBouncedEmail,
    };
  });

  const memberOptions = members.map((m) => ({
    value: m.uid,
    label: `${m.id} ${m.name}`,
  }));

  const contractStatusOptions = contractStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const contractTypeOptions = contractTypes.map((t) => ({
    value: t.name,
    label: t.name,
  }));

  const autoSendContract = slpProject?.autoSendContract ?? true;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">組合員名簿</h1>
      <MembersTable
        data={data}
        memberOptions={memberOptions}
        contractStatusOptions={contractStatusOptions}
        contractTypeOptions={contractTypeOptions}
        autoSendContract={autoSendContract}
      />
    </div>
  );
}
