import { prisma } from "@/lib/prisma";
import { ApplicationSupportTable } from "./application-support-table";
import { syncVendorIdFromFree1, VendorMismatch } from "@/lib/hojo/sync-vendor-id";

export default async function ApplicationSupportPage() {
  // 助成金申請サポートのLINE友達を全件取得
  const [allJoseiFriends, formSubmissions] = await Promise.all([
    prisma.hojoLineFriendJoseiSupport.findMany({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    }),
    // 事業計画フォームの回答（UID→回答データ紐付け用）
    prisma.hojoFormSubmission.findMany({
      where: { deletedAt: null, formType: "business-plan" },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  // uid → フォーム回答データ（最新のもの）
  const formSubmissionByUid = new Map<string, { id: number; submittedAt: string; answers: Record<string, unknown> }>();
  for (const s of formSubmissions) {
    const meta = (s.answers as Record<string, unknown>)?._meta as Record<string, unknown> | undefined;
    const uid = meta?.uid as string | null;
    if (uid && !formSubmissionByUid.has(uid)) {
      formSubmissionByUid.set(uid, {
        id: s.id,
        submittedAt: s.submittedAt.toISOString(),
        answers: s.answers as Record<string, unknown>,
      });
    }
  }

  // lineFriendId → uid のマップ
  const uidByLineFriendId = new Map<number, string>();
  for (const f of allJoseiFriends) {
    uidByLineFriendId.set(f.id, f.uid);
  }

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
  const existingLineFriendIds = new Set(existingRecords.map((r) => r.lineFriendId));

  // 顧客のLINE友達に対応するレコードがなければ自動作成（初回1レコード）
  const missingFriends = joseiLineFriends.filter(
    (f) => !existingLineFriendIds.has(f.id)
  );
  if (missingFriends.length > 0) {
    await prisma.hojoApplicationSupport.createMany({
      data: missingFriends.map((f) => ({ lineFriendId: f.id })),
      skipDuplicates: true,
    });
  }

  // free1→vendorIdを同期（初回自動設定のみ）+ 不一致情報取得
  const { mismatches } = await syncVendorIdFromFree1();

  // 同期後のデータを再取得
  existingRecords = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: { vendor: true, status: true, bbsStatusRef: true },
    orderBy: [{ lineFriendId: "asc" }, { id: "asc" }],
  });

  // lineFriendId → レコード群のマップ
  const recordsByLineFriendId = new Map<number, typeof existingRecords>();
  for (const r of existingRecords) {
    const arr = recordsByLineFriendId.get(r.lineFriendId) || [];
    arr.push(r);
    recordsByLineFriendId.set(r.lineFriendId, arr);
  }

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

  // 全ステータス（非アクティブ含む）
  const allStatuses = await prisma.hojoApplicationStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  const allStatusOptions = allStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // BBSステータス
  const bbsStatuses = await prisma.hojoBbsStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  const bbsStatusOptions = bbsStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));
  const allBbsStatuses = await prisma.hojoBbsStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });
  const allBbsStatusOptions = allBbsStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  // BBS No.を計算
  const bbsRecords = existingRecords
    .filter((r) => r.formAnswerDate !== null)
    .sort((a, b) => a.formAnswerDate!.getTime() - b.formAnswerDate!.getTime());
  const bbsNoMap = new Map<number, number>();
  bbsRecords.forEach((r, i) => {
    bbsNoMap.set(r.id, i + 1);
  });

  // 不一致マップ（applicationSupportId → mismatch）
  const mismatchMap = new Map<number, VendorMismatch>(
    mismatches.map((m) => [m.applicationSupportId, m])
  );

  // テーブルデータの整形（グループ化対応）
  let rowCounter = 0;
  const data = joseiLineFriends.flatMap((f) => {
    const records = recordsByLineFriendId.get(f.id) || [];
    if (records.length === 0) return [];

    return records.map((record, idx) => {
      rowCounter++;
      const mismatch = mismatchMap.get(record.id);
      const uid = uidByLineFriendId.get(f.id) || "";
      const submission = formSubmissionByUid.get(uid);
      return {
        id: record.id,
        rowNo: rowCounter,
        lineFriendId: f.id,
        lineFriendUid: uid,
        lineName: f.snsname || "-",
        vendorName: record.vendor?.name || "-",
        vendorId: record.vendorId ? String(record.vendorId) : "",
        vendorIdManual: record.vendorIdManual,
        statusId: record.statusId ? String(record.statusId) : "",
        applicantName: record.applicantName ?? "",
        detailMemo: record.detailMemo ?? "",
        formAnswerDate: record.formAnswerDate?.toISOString().slice(0, 10) ?? null,
        formTranscriptDate: record.formTranscriptDate?.toISOString().slice(0, 10) ?? null,
        applicationFormDate: record.applicationFormDate?.toISOString().slice(0, 10) ?? null,
        documentStorageUrl: record.documentStorageUrl ?? "",
        subsidyDesiredDate: record.subsidyDesiredDate?.toISOString().slice(0, 10) ?? null,
        subsidyAmount: record.subsidyAmount ?? null,
        paymentReceivedDate: record.paymentReceivedDate?.toISOString().slice(0, 10) ?? null,
        paymentReceivedAmount: record.paymentReceivedAmount ?? null,
        bbsTransferAmount: record.bbsTransferAmount ?? null,
        bbsTransferDate: record.bbsTransferDate?.toISOString().slice(0, 10) ?? null,
        subsidyReceivedDate: record.subsidyReceivedDate?.toISOString().slice(0, 10) ?? null,
        alkesMemo: record.alkesMemo ?? "",
        bbsMemo: record.bbsMemo ?? "",
        bbsNo: bbsNoMap.get(record.id) ?? null,
        bbsStatusId: record.bbsStatusId ? String(record.bbsStatusId) : "",
        vendorMemo: record.vendorMemo ?? "",
        // グループ化用
        groupSize: records.length,
        groupIndex: idx,
        // 不一致警告用
        hasMismatch: !!mismatch,
        mismatchResolvedVendorName: mismatch?.resolvedVendorName ?? null,
        mismatchResolvedVendorId: mismatch?.resolvedVendorId ?? null,
        // フォーム回答データ
        formSubmission: submission ? {
          id: submission.id,
          submittedAt: submission.submittedAt,
          answers: submission.answers,
        } : null,
      };
    });
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
