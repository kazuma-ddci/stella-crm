import { prisma } from "@/lib/prisma";
import { ApplicationSupportTable } from "./application-support-table";

export default async function ApplicationSupportPage() {
  // LINE友達情報（申請サポートセンター）を取得
  const lineFriends = await prisma.hojoLineFriendShinseiSupport.findMany({
    where: { deletedAt: null },
    orderBy: { id: "desc" },
  });

  // uid → LINE友達のマップ（紹介者の解決用）
  const uidToFriend = new Map(
    lineFriends.map((f) => [f.uid, { id: f.id, snsname: f.snsname }])
  );

  // ベンダー一覧
  const vendors = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  // ステータス一覧
  const statuses = await prisma.hojoApplicationStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  // 申請管理データ
  const records = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: {
      lineFriend: true,
      vendor: true,
      status: true,
    },
    orderBy: { id: "desc" },
  });

  // LINE友達の選択肢（降順）
  const lineFriendOptions = lineFriends.map((f) => ({
    value: String(f.id),
    label: `${f.id} ${f.snsname || "（名前なし）"}`,
  }));

  // ベンダーの選択肢
  const vendorOptions = vendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  // ステータスの選択肢
  const statusOptions = statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // テーブルデータの整形
  const data = records.map((r) => {
    // 紹介者の解決: LINE友達のfree1（uid）から別のLINE友達を探す
    let referrerDisplay = "-";
    if (r.lineFriend.free1) {
      const referrer = uidToFriend.get(r.lineFriend.free1);
      if (referrer) {
        referrerDisplay = `${referrer.id} ${referrer.snsname || "（名前なし）"}`;
      }
    }

    return {
      id: r.id,
      lineFriendId: String(r.lineFriendId),
      lineName: r.lineFriend.snsname || "-",
      referrer: referrerDisplay,
      vendorId: r.vendorId ? String(r.vendorId) : "",
      statusId: r.statusId ? String(r.statusId) : "",
      applicantName: r.applicantName,
      detailMemo: r.detailMemo,
      formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? null,
      formTranscriptDate: r.formTranscriptDate?.toISOString().slice(0, 10) ?? null,
      applicationFormDate: r.applicationFormDate?.toISOString().slice(0, 10) ?? null,
      documentStorageUrl: r.documentStorageUrl,
      paymentReceivedDate: r.paymentReceivedDate?.toISOString().slice(0, 10) ?? null,
      paymentReceivedAmount: r.paymentReceivedAmount,
      bbsTransferAmount: r.bbsTransferAmount,
      bbsTransferDate: r.bbsTransferDate?.toISOString().slice(0, 10) ?? null,
      subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? null,
      vendorMemo: r.vendorMemo || "",
    };
  });

  // LINE友達のfree1情報マップ（クライアント側で紹介者を動的表示するため）
  const lineFriendFree1Map: Record<string, string> = {};
  for (const f of lineFriends) {
    if (f.free1) {
      const referrer = uidToFriend.get(f.free1);
      if (referrer) {
        lineFriendFree1Map[String(f.id)] = `${referrer.id} ${referrer.snsname || "（名前なし）"}`;
      }
    }
  }

  // LINE友達のsnsname情報マップ（LINE名を動的表示するため）
  const lineFriendNameMap: Record<string, string> = {};
  for (const f of lineFriends) {
    lineFriendNameMap[String(f.id)] = f.snsname || "（名前なし）";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請サポートセンター用管理</h1>
      <ApplicationSupportTable
        data={data}
        lineFriendOptions={lineFriendOptions}
        vendorOptions={vendorOptions}
        statusOptions={statusOptions}
        lineFriendNameMap={lineFriendNameMap}
        lineFriendFree1Map={lineFriendFree1Map}
      />
    </div>
  );
}
