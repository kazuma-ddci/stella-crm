import { prisma } from "@/lib/prisma";
import { ApplicationSupportTable } from "./application-support-table";
import { syncVendorIdFromFree1 } from "@/lib/hojo/sync-vendor-id";

export default async function ApplicationSupportPage() {
  // 助成金申請サポートのLINE友達を全件取得
  const allJoseiFriends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { deletedAt: null },
    orderBy: { id: "asc" },
  });

  // 顧客のみ抽出
  const joseiLineFriends = allJoseiFriends.filter((f) => f.userType === "顧客");

  // ステータス一覧
  const statuses = await prisma.hojoApplicationStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });

  // 既存の申請管理レコードを取得
  let existingRecords = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: { vendor: true, status: true, bbsStatusRef: true },
  });
  const recordByLineFriendId = new Map(
    existingRecords.map((r) => [r.lineFriendId, r])
  );

  // 顧客のLINE友達に対応するレコードがなければ自動作成
  const missingFriends = joseiLineFriends.filter(
    (f) => !recordByLineFriendId.has(f.id)
  );
  if (missingFriends.length > 0) {
    await prisma.hojoApplicationSupport.createMany({
      data: missingFriends.map((f) => ({ lineFriendId: f.id })),
      skipDuplicates: true,
    });
  }

  // free1→vendorIdを全件同期（新規作成分 + free1変更分を一括処理）
  await syncVendorIdFromFree1();

  // 同期後のデータを再取得
  existingRecords = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: { vendor: true, status: true, bbsStatusRef: true },
  });
  const finalRecordMap = new Map(
    existingRecords.map((r) => [r.lineFriendId, r])
  );

  // ベンダーの選択肢（編集フォーム用）
  const activeVendors = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  const vendorOptions = activeVendors.map((v) => ({
    value: String(v.id),
    label: v.name,
  }));

  // ステータスの選択肢
  const statusOptions = statuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 全ステータス（非アクティブ含む、赤色表示用）
  const allStatuses = await prisma.hojoApplicationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  const allStatusOptions = allStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // BBSステータス一覧
  const bbsStatuses = await prisma.hojoBbsStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  const bbsStatusOptions = bbsStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // 全BBSステータス（非アクティブ含む、赤色表示用）
  const allBbsStatuses = await prisma.hojoBbsStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  const allBbsStatusOptions = allBbsStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // BBS No.を計算（BBS側と同じ条件: formAnswerDateあり、formAnswerDate昇順）
  const bbsRecords = existingRecords
    .filter((r) => r.formAnswerDate !== null)
    .sort((a, b) => a.formAnswerDate!.getTime() - b.formAnswerDate!.getTime());
  const bbsNoMap = new Map<number, number>();
  bbsRecords.forEach((r, i) => {
    bbsNoMap.set(r.id, i + 1);
  });

  // テーブルデータの整形
  const data = joseiLineFriends.map((f) => {
    const record = finalRecordMap.get(f.id);

    return {
      id: record?.id ?? 0,
      lineFriendId: f.id,
      lineName: f.snsname || "-",
      vendorName: record?.vendor?.name || "-",
      vendorId: record?.vendorId ? String(record.vendorId) : "",
      statusId: record?.statusId ? String(record.statusId) : "",
      applicantName: record?.applicantName ?? "",
      detailMemo: record?.detailMemo ?? "",
      formAnswerDate: record?.formAnswerDate?.toISOString().slice(0, 10) ?? null,
      formTranscriptDate: record?.formTranscriptDate?.toISOString().slice(0, 10) ?? null,
      applicationFormDate: record?.applicationFormDate?.toISOString().slice(0, 10) ?? null,
      documentStorageUrl: record?.documentStorageUrl ?? "",
      subsidyDesiredDate: record?.subsidyDesiredDate?.toISOString().slice(0, 10) ?? null,
      subsidyAmount: record?.subsidyAmount ?? null,
      paymentReceivedDate: record?.paymentReceivedDate?.toISOString().slice(0, 10) ?? null,
      paymentReceivedAmount: record?.paymentReceivedAmount ?? null,
      bbsTransferAmount: record?.bbsTransferAmount ?? null,
      bbsTransferDate: record?.bbsTransferDate?.toISOString().slice(0, 10) ?? null,
      subsidyReceivedDate: record?.subsidyReceivedDate?.toISOString().slice(0, 10) ?? null,
      alkesMemo: record?.alkesMemo ?? "",
      bbsMemo: record?.bbsMemo ?? "",
      bbsNo: record ? (bbsNoMap.get(record.id) ?? null) : null,
      bbsStatusId: record?.bbsStatusId ? String(record.bbsStatusId) : "",
      vendorMemo: record?.vendorMemo ?? "",
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">申請者管理</h1>
      <ApplicationSupportTable
        data={data}
        vendorOptions={vendorOptions}
        statusOptions={statusOptions}
        allStatusOptions={allStatusOptions}
        bbsStatusOptions={bbsStatusOptions}
        allBbsStatusOptions={allBbsStatusOptions}
      />
    </div>
  );
}
