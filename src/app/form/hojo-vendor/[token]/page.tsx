import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { VendorPageClient } from "./vendor-page-client";

export default async function VendorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const vendor = await prisma.hojoVendor.findUnique({
    where: { accessToken: token },
  });

  if (!vendor || !vendor.isActive) {
    notFound();
  }

  // このベンダーに紐づく申請管理データを取得
  const records = await prisma.hojoApplicationSupport.findMany({
    where: {
      vendorId: vendor.id,
      deletedAt: null,
    },
    include: {
      lineFriend: true,
      vendor: true,
      status: true,
    },
    orderBy: { id: "desc" },
  });

  // 紹介者解決用のUID→LINE友達マップ
  const lineFriendIds = records.map((r) => r.lineFriendId);
  const allLineFriends = await prisma.hojoLineFriendShinseiSupport.findMany({
    where: { deletedAt: null },
  });
  const uidToFriend = new Map(
    allLineFriends.map((f) => [f.uid, { id: f.id, snsname: f.snsname }])
  );

  const data = records.map((r) => {
    let referrerDisplay = "-";
    if (r.lineFriend.free1) {
      const referrer = uidToFriend.get(r.lineFriend.free1);
      if (referrer) {
        referrerDisplay = `${referrer.id} ${referrer.snsname || ""}`;
      }
    }

    return {
      id: r.id,
      lineFriendId: r.lineFriendId,
      lineName: r.lineFriend.snsname || "-",
      referrer: referrerDisplay,
      vendorName: r.vendor?.name || "-",
      applicantName: r.applicantName || "-",
      statusName: r.status?.name || "-",
      detailMemo: r.detailMemo || "",
      formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? null,
      paymentReceivedDate: r.paymentReceivedDate?.toISOString().slice(0, 10) ?? null,
      paymentReceivedAmount: r.paymentReceivedAmount,
      subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? null,
      vendorMemo: r.vendorMemo || "",
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{vendor.name} — 申請管理</h1>
        <VendorPageClient data={data} vendorToken={token} />
      </div>
    </div>
  );
}
