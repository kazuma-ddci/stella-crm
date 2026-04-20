import { prisma } from "@/lib/prisma";

/**
 * 申請者レコードと最新のフォーム回答を1クエリで取得する。
 * PDF生成系で毎回同じクエリを書いていたので集約。
 */
export async function loadApplicationSupportWithLatestAnswers(
  applicationSupportId: number,
) {
  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: applicationSupportId },
    include: {
      lineFriend: true,
      linkedFormSubmissions: {
        where: { deletedAt: null, formType: "business-plan" },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!record) throw new Error("申請者レコードが見つかりません");
  const submission = record.linkedFormSubmissions[0];
  if (!submission) throw new Error("紐付くフォーム回答が見つかりません");

  const answers = submission.answers as Record<string, unknown>;
  const modifiedAnswers =
    (submission.modifiedAnswers as Record<string, unknown> | null) ?? null;

  return { record, submission, answers, modifiedAnswers };
}
