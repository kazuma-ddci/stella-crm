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

export default async function ApplicantInfoPage() {
  const [joseiFriendsAll, vendors, joseiProline] = await Promise.all([
    prisma.hojoLineFriendJoseiSupport.findMany({
      where: { deletedAt: null },
      orderBy: [{ id: "asc" }],
    }),
    prisma.hojoVendor.findMany({
      where: { joseiLineFriendId: { not: null } },
      select: { joseiLineFriendId: true, name: true },
    }),
    prisma.hojoProlineAccount.findFirst({
      where: { lineType: "josei-support" },
      select: { label: true },
    }),
  ]);

  // joseiLineFriendId → ベンダー名 のマップ
  const vendorByJoseiId = new Map(
    vendors.map((v) => [v.joseiLineFriendId!, v.name])
  );

  // uid → joseiId のマップ（free1からの逆引き用）
  const joseiByUid = new Map(
    joseiFriendsAll.map((f) => [f.uid, f.id])
  );

  // 申請者情報タブ用データ
  const applicantData = joseiFriendsAll.map((f) => {
    const isVendor = vendorByJoseiId.has(f.id);
    const displayUserType = isVendor ? "ベンダー" : f.userType;

    let vendorName: string | null = null;
    let hasError = false;

    if (f.free1) {
      const referredId = joseiByUid.get(f.free1);
      if (referredId !== undefined) {
        const vName = vendorByJoseiId.get(referredId);
        if (vName) {
          vendorName = vName;
        } else {
          if (displayUserType === "顧客") {
            hasError = true;
          }
        }
      }
    }

    return {
      id: f.id,
      snsname: f.snsname,
      uid: f.uid,
      userType: displayUserType,
      isVendor,
      vendorName,
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

  // 申請者情報タブでエラーになっているユーザーのID一覧（助成金申請サポートタブでも強調用）
  const joseiInvalidIds = applicantData
    .filter((a) => a.hasError)
    .map((a) => a.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請者情報</h1>
      <ApplicantPageClient
        applicantData={applicantData}
        joseiData={joseiData}
        joseiLastSync={joseiLastSync}
        joseiInvalidIds={joseiInvalidIds}
        joseiLabel={joseiProline?.label || "助成金申請サポート"}
      />
    </div>
  );
}
