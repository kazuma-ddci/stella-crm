import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildBbsFormCsv, type BbsFormCsvRow } from "@/lib/hojo/bbs-form-csv";

/**
 * BBS用 支援制度申請フォームの確定済み回答をCSVでダウンロード。
 *
 * 権限: BBS または スタッフのみ。
 * 対象: formTranscriptDate が入っている申請者レコードに紐付く確定済み回答。
 * 形式: BBS社のGoogleフォーム→スプレッドシート互換（タイムスタンプ + 31問のtitle列）。
 */
export async function GET() {
  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isBbs = userType === "bbs";
  if (!isStaff && !isBbs) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (isBbs && session?.user?.mustChangePassword) {
    return NextResponse.json({ error: "パスワード変更が必要です" }, { status: 403 });
  }

  const appSupports = await prisma.hojoApplicationSupport.findMany({
    where: {
      deletedAt: null,
      formTranscriptDate: { not: null },
      lineFriend: { userType: "顧客" },
    },
    include: {
      linkedFormSubmissions: {
        where: { deletedAt: null, formType: "business-plan" },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { formTranscriptDate: "asc" },
  });

  const rows: BbsFormCsvRow[] = appSupports
    .map((r) => {
      const submission = r.linkedFormSubmissions[0];
      if (!submission || !r.formTranscriptDate) return null;
      return {
        formTranscriptDate: r.formTranscriptDate,
        answers: submission.answers as Record<string, unknown>,
        modifiedAnswers:
          (submission.modifiedAnswers as Record<string, unknown> | null) ?? null,
        fileUrls:
          (submission.fileUrls as Record<string, { filePath?: string; fileName?: string }> | null) ?? null,
      } satisfies BbsFormCsvRow;
    })
    .filter((x): x is BbsFormCsvRow => x !== null);

  const csv = buildBbsFormCsv(rows);
  const filename = `shien_form_answers_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
