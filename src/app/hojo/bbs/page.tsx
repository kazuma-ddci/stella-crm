import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BbsClientPage } from "./bbs-client-page";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FileInfo } from "@/components/hojo/form-answer-editor";

export const metadata: Metadata = {
  title: "支援金管理ページ",
};

export default async function BbsPage() {
  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isBbs = userType === "bbs";
  const isAuthenticated = isStaff || isBbs;
  const staffCanEdit =
    isStaff &&
    canEditProjectMasterDataSync(session?.user, "hojo");

  if (!isAuthenticated) {
    return <BbsClientPage authenticated={false} isBbs={false} data={[]} />;
  }

  // BBSユーザーでmustChangePasswordの場合は /hojo/bbs/change-password に誘導する。
  if (isBbs && session?.user?.mustChangePassword) {
    redirect("/hojo/bbs/change-password");
  }

  // BBSに共有するのは「確定済み」（formTranscriptDate が入っている）ものだけ
  const records = await prisma.hojoApplicationSupport.findMany({
    where: {
      deletedAt: null,
      formTranscriptDate: { not: null },
      wholesaleAccount: { deletedAt: null, deletedByVendor: false },
    },
    include: {
      wholesaleAccount: true,
      linkedFormSubmissions: {
        where: { deletedAt: null, formType: "business-plan" },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { formTranscriptDate: "asc" },
  });

  const data = records.map((r) => {
    const submission = r.linkedFormSubmissions[0] ?? null;
    return {
      id: r.id,
      applicantName: r.applicantName || "-",
      formTranscriptDate: r.formTranscriptDate?.toISOString().slice(0, 10) ?? "-",
      applicationFormDate: r.applicationFormDate?.toISOString().slice(0, 10) ?? "",
      bbsStatusId: r.bbsStatusId,
      subsidyDesiredDate: r.subsidyDesiredDate?.toISOString().slice(0, 10) ?? "-",
      subsidyAmount: r.subsidyAmount,
      bbsTransferDate: r.bbsTransferDate?.toISOString().slice(0, 10) ?? "-",
      subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? "-",
      alkesMemo: r.alkesMemo || "",
      bbsMemo: r.bbsMemo || "",
      submission: submission
        ? {
            id: submission.id,
            answers: submission.answers as Record<string, unknown>,
            modifiedAnswers:
              (submission.modifiedAnswers as Record<string, Record<string, string | null>> | null) ?? null,
            fileUrls: (submission.fileUrls as Record<string, FileInfo> | null) ?? null,
          }
        : null,
    };
  });

  // BBSステータス選択肢
  const bbsStatuses = await prisma.hojoBbsStatus.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  const bbsStatusOptions = bbsStatuses.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const userName = session?.user?.name || "";

  return (
    <BbsClientPage
      authenticated={true}
      isBbs={isBbs}
      canEdit={isBbs || staffCanEdit}
      data={data}
      userName={userName}
      bbsStatusOptions={bbsStatusOptions}
    />
  );
}
