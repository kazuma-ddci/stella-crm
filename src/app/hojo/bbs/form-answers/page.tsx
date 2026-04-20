import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BbsClientFormAnswersPage } from "./bbs-form-answers-client";
import type { Metadata } from "next";
import type { FileInfo, ModifiedAnswers } from "@/components/hojo/form-answer-editor";

export const metadata: Metadata = {
  title: "支援制度申請フォーム",
};

export default async function BbsFormAnswersPage() {
  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isBbs = userType === "bbs";
  const isAuthenticated = isStaff || isBbs;

  if (!isAuthenticated || (isBbs && session?.user?.mustChangePassword)) {
    return <BbsClientFormAnswersPage authenticated={false} isBbs={false} data={[]} />;
  }

  // 確定済み申請者レコードに紐付くフォーム回答のみ
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

  const data = appSupports
    .map((r) => {
      const submission = r.linkedFormSubmissions[0];
      if (!submission) return null;
      const answers = submission.answers as Record<string, unknown>;
      const basic = (answers?.basic as Record<string, string>) ?? {};
      return {
        id: submission.id,
        applicationSupportId: r.id,
        applicantName: r.applicantName ?? basic.fullName ?? "-",
        tradeName: basic.tradeName ?? "-",
        formTranscriptDate: r.formTranscriptDate?.toISOString().slice(0, 10) ?? "-",
        submittedAt: submission.submittedAt.toISOString(),
        answers,
        modifiedAnswers: (submission.modifiedAnswers as ModifiedAnswers | null) ?? null,
        fileUrls: (submission.fileUrls as Record<string, FileInfo> | null) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const userName = session?.user?.name || "";

  return (
    <BbsClientFormAnswersPage
      authenticated={true}
      isBbs={isBbs}
      data={data}
      userName={userName}
    />
  );
}
