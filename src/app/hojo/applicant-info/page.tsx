import { prisma } from "@/lib/prisma";
import { ApplicantPageClient } from "./applicant-info-table";

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
  nextContactDate: Date | null;
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
    nextContactDate: f.nextContactDate ? f.nextContactDate.toISOString().split("T")[0] : null,
  };
}

export default async function ApplicantInfoPage() {
  const [joseiFriendsAll, vendors, joseiProline, applicationSupports] = await Promise.all([
    prisma.hojoLineFriendJoseiSupport.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
    }),
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, joseiLineFriendId: true,
        contacts: { select: { joseiLineFriendId: true } },
      },
    }),
    prisma.hojoProlineAccount.findFirst({
      where: { lineType: "josei-support" },
      select: { label: true },
    }),
    // 申請者管理の全レコードを取得（紹介元ベンダー表示用）
    prisma.hojoApplicationSupport.findMany({
      where: { deletedAt: null },
      select: { lineFriendId: true, vendorId: true, vendor: { select: { name: true } } },
    }),
  ]);

  // joseiLineFriendId → ベンダー名リスト のマップ（旧フィールド + contacts両方から構築）
  const vendorNamesByJoseiId = new Map<number, string[]>();
  function addVendorJosei(joseiId: number, name: string) {
    const names = vendorNamesByJoseiId.get(joseiId) || [];
    if (!names.includes(name)) names.push(name);
    vendorNamesByJoseiId.set(joseiId, names);
  }
  for (const v of vendors) {
    if (v.joseiLineFriendId) addVendorJosei(v.joseiLineFriendId, v.name);
    for (const c of v.contacts) {
      if (c.joseiLineFriendId) addVendorJosei(c.joseiLineFriendId, v.name);
    }
  }

  // uid → joseiId のマップ（free1からの逆引き用）
  const joseiByUid = new Map(
    joseiFriendsAll.map((f) => [f.uid, f.id])
  );

  // lineFriendId → 紹介元ベンダー名リスト（重複なし）
  const vendorNamesByLineFriendId = new Map<number, string[]>();
  for (const as of applicationSupports) {
    if (as.vendor?.name) {
      const names = vendorNamesByLineFriendId.get(as.lineFriendId) || [];
      if (!names.includes(as.vendor.name)) {
        names.push(as.vendor.name);
      }
      vendorNamesByLineFriendId.set(as.lineFriendId, names);
    }
  }

  // 申請者情報タブ用データ
  const applicantData = joseiFriendsAll.map((f) => {
    const belongsToVendors = vendorNamesByJoseiId.get(f.id) || [];
    const isVendor = belongsToVendors.length > 0;
    const displayUserType = isVendor
      ? `ベンダー(${belongsToVendors.join(",")})`
      : f.userType;

    // 紹介元ベンダー: 申請者管理のレコードから取得（複数ベンダー対応）
    const vendorNamesFromRecords = vendorNamesByLineFriendId.get(f.id) || [];

    // free1からのベンダー判定（エラー検出用）
    let vendorNameFromFree1: string | null = null;
    let hasError = false;

    if (f.free1) {
      const referredId = joseiByUid.get(f.free1);
      if (referredId !== undefined) {
        const vNames = vendorNamesByJoseiId.get(referredId);
        if (vNames && vNames.length > 0) {
          vendorNameFromFree1 = vNames[0];
        } else {
          if (displayUserType === "顧客") {
            hasError = true;
          }
        }
      }
    }

    // 表示用ベンダー名: 申請者管理のレコードがあればそちらを優先、なければfree1から
    const vendorNames = vendorNamesFromRecords.length > 0
      ? vendorNamesFromRecords
      : vendorNameFromFree1
        ? [vendorNameFromFree1]
        : [];

    return {
      id: f.id,
      snsname: f.snsname,
      uid: f.uid,
      userType: displayUserType,
      isVendor,
      vendorName: vendorNames.length > 0 ? vendorNames.join(", ") : null,
      nextContactDate: f.nextContactDate ? f.nextContactDate.toISOString().split("T")[0] : null,
      hasError,
    };
  });

  // 助成金申請サポートタブ用データ
  const joseiData = joseiFriendsAll.map(formatLineFriend);
  const joseiLastSync = joseiFriendsAll.length > 0
    ? joseiFriendsAll
        .reduce((latest, f) => (f.updatedAt > latest ? f.updatedAt : latest), new Date(0))
        .toISOString()
    : null;

  const joseiInvalidIds = applicantData
    .filter((a) => a.hasError)
    .map((a) => a.id);

  // 申請サポートLINE内のfree1重複を検出
  const joseiFree1Count = new Map<string, number[]>();
  for (const f of joseiFriendsAll) {
    if (f.free1) {
      const ids = joseiFree1Count.get(f.free1) || [];
      ids.push(f.id);
      joseiFree1Count.set(f.free1, ids);
    }
  }
  const joseiDuplicateIds: number[] = [];
  for (const ids of joseiFree1Count.values()) {
    if (ids.length > 1) joseiDuplicateIds.push(...ids);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請者情報</h1>
      <ApplicantPageClient
        applicantData={applicantData}
        joseiData={joseiData}
        joseiLastSync={joseiLastSync}
        joseiInvalidIds={joseiInvalidIds}
        joseiDuplicateIds={joseiDuplicateIds}
        joseiLabel={joseiProline?.label || "\u52A9\u6210\u91D1\u7533\u8ACB\u30B5\u30DD\u30FC\u30C8"}
      />
    </div>
  );
}
