import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ApplicationSupportTable } from "./application-support-table";
import { syncVendorIdFromFree1, VendorMismatch } from "@/lib/hojo/sync-vendor-id";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";

export default async function ApplicationSupportPage() {
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEditAnswers =
    session?.user?.userType === "staff" && canEditProject(userPermissions, "hojo");
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
  const formSubmissionByUid = new Map<
    string,
    {
      id: number;
      submittedAt: string;
      confirmedAt: string | null;
      linkedApplicationSupportId: number | null;
      answers: Record<string, unknown>;
      modifiedAnswers: Record<string, Record<string, string | null>> | null;
      fileUrls: Record<string, unknown> | null;
    }
  >();
  for (const s of formSubmissions) {
    const meta = (s.answers as Record<string, unknown>)?._meta as Record<string, unknown> | undefined;
    const uid = meta?.uid as string | null;
    if (uid && !formSubmissionByUid.has(uid)) {
      formSubmissionByUid.set(uid, {
        id: s.id,
        submittedAt: s.submittedAt.toISOString(),
        confirmedAt: s.confirmedAt?.toISOString() ?? null,
        linkedApplicationSupportId: s.linkedApplicationSupportId,
        answers: s.answers as Record<string, unknown>,
        modifiedAnswers:
          (s.modifiedAnswers as Record<string, Record<string, string | null>> | null) ?? null,
        fileUrls: (s.fileUrls as Record<string, unknown> | null) ?? null,
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

  // ステータス一覧（軽量クエリなので直列でOK）と、既存レコードの
  // lineFriendId だけの軽量チェックを並列化
  const [statuses, existingLineFriendIdRows] = await Promise.all([
    prisma.hojoApplicationStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoApplicationSupport.findMany({
      where: { deletedAt: null },
      select: { lineFriendId: true },
    }),
  ]);
  const existingLineFriendIds = new Set(existingLineFriendIdRows.map((r) => r.lineFriendId));

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

  // 本番データを1回だけ取得（include込みの重クエリはここだけ）
  const existingRecords = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null },
    include: { vendor: true, status: true, bbsStatusRef: true, documents: true },
    orderBy: [{ lineFriendId: "asc" }, { id: "asc" }],
  });

  // lineFriendId → レコード群のマップ
  const recordsByLineFriendId = new Map<number, typeof existingRecords>();
  for (const r of existingRecords) {
    const arr = recordsByLineFriendId.get(r.lineFriendId) || [];
    arr.push(r);
    recordsByLineFriendId.set(r.lineFriendId, arr);
  }

  // 選択肢系のクエリは互いに独立なので並列化
  const [activeVendors, allStatuses, bbsStatuses, allBbsStatuses] = await Promise.all([
    prisma.hojoVendor.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoApplicationStatus.findMany({
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoBbsStatus.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.hojoBbsStatus.findMany({
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const vendorOptions = activeVendors.map((v) => ({ value: String(v.id), label: v.name }));
  const statusOptions = statuses.map((s) => ({ value: String(s.id), label: s.name }));
  const allStatusOptions = allStatuses.map((s) => ({ value: String(s.id), label: s.name }));
  const bbsStatusOptions = bbsStatuses.map((s) => ({ value: String(s.id), label: s.name }));
  const allBbsStatusOptions = allBbsStatuses.map((s) => ({ value: String(s.id), label: s.name }));

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
          confirmedAt: submission.confirmedAt,
          linkedApplicationSupportId: submission.linkedApplicationSupportId,
          answers: submission.answers,
          modifiedAnswers: submission.modifiedAnswers,
          fileUrls: submission.fileUrls,
        } : null,
        documents: record.documents.map((d) => ({
          docType: d.docType,
          filePath: d.filePath,
          fileName: d.fileName,
          generatedAt: d.generatedAt.toISOString(),
          generatedSections: (d.generatedSections as Record<string, string> | null) ?? null,
          editedSections: (d.editedSections as Record<string, string> | null) ?? null,
          modelName: d.modelName,
          inputTokens: d.inputTokens,
          outputTokens: d.outputTokens,
          cacheReadTokens: d.cacheReadTokens,
          cacheCreationTokens: d.cacheCreationTokens,
          costUsd: d.costUsd ? d.costUsd.toString() : null,
          hasPreviousBackup: !!d.previousFilePath,
        })),
        existingDocTypes: {
          trainingReport: record.documents.some((d) => d.docType === "training_report"),
          supportApplication: record.documents.some((d) => d.docType === "support_application"),
          businessPlan: record.documents.some((d) => d.docType === "business_plan"),
        },
        pdfGenerationRunningDocType: record.pdfGenerationRunningDocType ?? null,
        pdfGenerationRunningAt: record.pdfGenerationRunningAt?.toISOString() ?? null,
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
        canEditAnswers={canEditAnswers}
      />
    </div>
  );
}
