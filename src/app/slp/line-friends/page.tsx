import { prisma } from "@/lib/prisma";
import { LineFriendsPageTabs } from "./line-friends-page-tabs";

export default async function SlpLineFriendsPage() {
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [friends, prolineAccount, slpMembers, slpAsRecords, slpStaffPermissions] = await Promise.all([
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
    }),
    prisma.slpProlineAccount.findFirst({
      where: { isActive: true },
      select: { label: true },
    }),
    prisma.slpMember.findMany({
      where: { deletedAt: null },
      select: {
        uid: true,
        contracts: {
          select: { cloudsignStatus: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.slpAs.findMany({
      orderBy: { id: "asc" },
      include: {
        lineFriend: { select: { id: true, snsname: true } },
        staff: { select: { id: true, name: true } },
      },
    }),
    slpProject
      ? prisma.staffPermission.findMany({
          where: {
            projectId: slpProject.id,
            permissionLevel: { in: ["view", "edit", "manager"] },
          },
          select: {
            staff: {
              select: { id: true, name: true, isActive: true, isSystemUser: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const lineLabel = prolineAccount?.label || "公式LINE";

  // 最終同期日時（同期済みレコードの最新updatedAt）
  const lastSyncAt = friends.length > 0
    ? friends.reduce((latest, f) => (f.updatedAt > latest ? f.updatedAt : latest), new Date(0))
    : null;

  // uid → {displayNo, snsname} のマップ（紹介者解決用 + free1バリデーション用）
  const friendByUidMap = new Map<string, { displayNo: number; snsname: string | null }>();
  for (const f of friends) {
    friendByUidMap.set(f.uid, { displayNo: f.id, snsname: f.snsname });
  }

  const data = friends.map((f) => ({
    id: f.id,
    displayNo: f.id,
    snsname: f.snsname,
    password: f.password,
    emailLine: f.emailLine,
    emailRenkei: f.emailRenkei,
    emailLine2: f.emailLine2,
    email: f.email,
    uid: f.uid,
    friendAddedDate: f.friendAddedDate?.toISOString().slice(0, 16).replace("T", " ") ?? null,
    activeStatus: f.activeStatus,
    lastActivityDate: f.lastActivityDate,
    sei: f.sei,
    mei: f.mei,
    nickname: f.nickname,
    phone: f.phone,
    postcode: f.postcode,
    address1: f.address1,
    address2: f.address2,
    address3: f.address3,
    nenrei: f.nenrei,
    nendai: f.nendai,
    seibetu: f.seibetu,
    free1: f.free1,
    free1Invalid: !!(f.free1 && !friendByUidMap.has(f.free1)),
    free2: f.free2,
    free3: f.free3,
    free4: f.free4,
    free5: f.free5,
    free6: f.free6,
    scenarioPos1: f.scenarioPos1,
    scenarioPos2: f.scenarioPos2,
    scenarioPos3: f.scenarioPos3,
    scenarioPos4: f.scenarioPos4,
    scenarioPos5: f.scenarioPos5,
    isManuallyAdded: f.isManuallyAdded,
  }));

  // ユーザー情報タブ用データ
  // uid → SlpMember の契約ステータスをマップ
  const memberStatusMap = new Map<string, string>();
  for (const m of slpMembers) {
    const contract = m.contracts[0];
    if (!contract) {
      // フォーム回答済みだが契約レコードなし → 契約書送付待ち
      memberStatusMap.set(m.uid, "契約書送付待ち");
    } else if (contract.cloudsignStatus === "completed") {
      memberStatusMap.set(m.uid, "組合員登録済み");
    } else if (contract.cloudsignStatus === "sent") {
      memberStatusMap.set(m.uid, "締結待ち");
    } else {
      // draft, canceled等
      memberStatusMap.set(m.uid, "契約書送付待ち");
    }
  }

  const userData = friends.map((f) => {
    // 紹介者: free1にuidが入っている → そのuidのLINE友達を検索
    let referrerDisplay = "";
    if (f.free1) {
      const referrer = friendByUidMap.get(f.free1);
      if (referrer) {
        referrerDisplay = `${referrer.displayNo} ${referrer.snsname ?? ""}`.trim();
      }
    }

    return {
      id: f.id,
      displayNo: f.id,
      snsname: f.snsname,
      referrer: referrerDisplay,
      memberStatus: memberStatusMap.get(f.uid) ?? "",
    };
  });

  // AS管理タブ用データ
  const asData = slpAsRecords.map((a) => ({
    id: a.id,
    name: a.name,
    lineFriendId: a.lineFriendId,
    lineFriendLabel: a.lineFriend
      ? `${a.lineFriend.id} ${a.lineFriend.snsname ?? ""}`.trim()
      : null,
    staffId: a.staffId,
    staffName: a.staff?.name ?? null,
  }));

  // AS管理タブ用 LINE友達選択肢
  const lineFriendOptions = friends.map((f) => ({
    id: f.id,
    label: `${f.id} ${f.snsname ?? ""}`.trim(),
  }));

  // AS管理タブ用 スタッフ選択肢
  const staffOptions = slpStaffPermissions
    .filter((p) => p.staff.isActive && !p.staff.isSystemUser)
    .map((p) => ({ id: p.staff.id, name: p.staff.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lineLabel} 友達情報</h1>
      <LineFriendsPageTabs
        data={data}
        userData={userData}
        lastSyncAt={lastSyncAt?.toISOString() ?? null}
        asData={asData}
        lineFriendOptions={lineFriendOptions}
        staffOptions={staffOptions}
      />
    </div>
  );
}
