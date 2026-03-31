import { prisma } from "@/lib/prisma";
import { CustomerPageClient } from "./user-info-table";

function formatLineFriend(f: {
  id: number;
  snsname: string | null;
  password: string | null;
  emailLine: string | null;
  emailRenkei: string | null;
  emailLine2: string | null;
  email: string | null;
  uid: string;
  friendAddedDate: Date | null;
  activeStatus: string | null;
  lastActivityDate: string | null;
  sei: string | null;
  mei: string | null;
  nickname: string | null;
  phone: string | null;
  postcode: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  nenrei: string | null;
  nendai: string | null;
  seibetu: string | null;
  free1: string | null;
  free2: string | null;
  free3: string | null;
  free4: string | null;
  free5: string | null;
  free6: string | null;
  scenarioPos1: string | null;
  scenarioPos2: string | null;
  scenarioPos3: string | null;
  scenarioPos4: string | null;
  scenarioPos5: string | null;
  updatedAt: Date;
}) {
  return {
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
  };
}

function calcLastSyncAt(friends: { updatedAt: Date }[]): string | null {
  if (friends.length === 0) return null;
  return friends
    .reduce((latest, f) => (f.updatedAt > latest ? f.updatedAt : latest), new Date(0))
    .toISOString();
}

export default async function CustomerInfoPage() {
  const [scFriends, shinseiFriends, alkesFriends, shinseiFree1, alkesFree1, vendors, prolineAccounts] =
    await Promise.all([
      prisma.hojoLineFriendSecurityCloud.findMany({
        where: { deletedAt: null },
        orderBy: [{ id: "asc" }],
      }),
      prisma.hojoLineFriendShinseiSupport.findMany({
        where: { deletedAt: null },
        orderBy: [{ id: "asc" }],
      }),
      prisma.hojoLineFriendAlkes.findMany({
        where: { deletedAt: null },
        orderBy: [{ id: "asc" }],
      }),
      prisma.hojoLineFriendShinseiSupport.findMany({
        where: { deletedAt: null, free1: { not: null } },
        select: { free1: true },
      }),
      prisma.hojoLineFriendAlkes.findMany({
        where: { deletedAt: null, free1: { not: null } },
        select: { free1: true },
      }),
      prisma.hojoVendor.findMany({
        where: { lineFriendId: { not: null } },
        select: { lineFriendId: true, name: true },
      }),
      prisma.hojoProlineAccount.findMany({
        select: { lineType: true, label: true },
      }),
    ]);

  const scUidSet = new Set(scFriends.map((f) => f.uid));
  const shinseiUidSet = new Set(shinseiFree1.map((f) => f.free1).filter(Boolean));
  const alkesUidSet = new Set(alkesFree1.map((f) => f.free1).filter(Boolean));
  const vendorByScId = new Map(vendors.map((v) => [v.lineFriendId!, v.name]));

  // free1がセキュリティクラウドのUIDに存在しないIDを特定
  const shinseiInvalidIds: number[] = [];
  for (const f of shinseiFriends) {
    if (f.free1 && !scUidSet.has(f.free1)) {
      shinseiInvalidIds.push(f.id);
    }
  }
  const alkesInvalidIds: number[] = [];
  for (const f of alkesFriends) {
    if (f.free1 && !scUidSet.has(f.free1)) {
      alkesInvalidIds.push(f.id);
    }
  }

  const customerData = scFriends.map((f) => {
    const isVendor = vendorByScId.has(f.id);
    return {
      id: f.id,
      snsname: f.snsname,
      uid: f.uid,
      userType: isVendor ? "ベンダー" : f.userType,
      isVendor,
      hasShinseiSupport: shinseiUidSet.has(f.uid),
      hasAlkes: alkesUidSet.has(f.uid),
    };
  });

  // プロラインラベルのマップ
  const labelMap: Record<string, string> = {};
  for (const a of prolineAccounts) {
    labelMap[a.lineType] = a.label;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">顧客情報</h1>
      <CustomerPageClient
        customerData={customerData}
        securityCloudData={scFriends.map(formatLineFriend)}
        securityCloudLastSync={calcLastSyncAt(scFriends)}
        securityCloudLabel={labelMap["security-cloud"] || "セキュリティクラウド"}
        alkesData={alkesFriends.map(formatLineFriend)}
        alkesLastSync={calcLastSyncAt(alkesFriends)}
        alkesInvalidIds={alkesInvalidIds}
        alkesLabel={labelMap["alkes"] || "ALKES"}
        shinseiData={shinseiFriends.map(formatLineFriend)}
        shinseiLastSync={calcLastSyncAt(shinseiFriends)}
        shinseiInvalidIds={shinseiInvalidIds}
        shinseiLabel={labelMap["shinsei-support"] || "申請サポートセンター"}
      />
    </div>
  );
}
