import { prisma } from "@/lib/prisma";
import { LineFriendsTable } from "./line-friends-table";

export default async function SecurityCloudLineFriendsPage() {
  const friends = await prisma.hojoLineFriendSecurityCloud.findMany({
    where: { deletedAt: null },
    orderBy: [{ id: "asc" }],
  });

  const lastSyncAt = friends.length > 0
    ? friends.reduce((latest, f) => (f.updatedAt > latest ? f.updatedAt : latest), new Date(0))
    : null;

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
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">セキュリティクラウドサポート — LINE友達情報</h1>
      <LineFriendsTable data={data} lastSyncAt={lastSyncAt?.toISOString() ?? null} />
    </div>
  );
}
