import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { FormSubmissionEditClient } from "./edit-client";
import type { ModifiedAnswers, FileInfo } from "@/components/hojo/form-answer-editor";
import { extractSubmissionMeta } from "@/lib/hojo/form-answer-sections";

export default async function HojoFormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEdit = session?.user?.userType === "staff" && canEditProject(userPermissions, "hojo");

  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: parseInt(id) },
    include: {
      linkedApplicationSupport: {
        select: {
          formTranscriptDate: true,
          subsidyAmount: true,
          trainingReportRunningAt: true,
          supportApplicationRunningAt: true,
          businessPlanRunningAt: true,
          documents: { select: { docType: true } },
        },
      },
    },
  });
  if (!submission || submission.deletedAt) notFound();

  const existingDocTypes = {
    trainingReport:
      submission.linkedApplicationSupport?.documents.some((d) => d.docType === "training_report") ?? false,
    supportApplication:
      submission.linkedApplicationSupport?.documents.some((d) => d.docType === "support_application") ?? false,
    businessPlan:
      submission.linkedApplicationSupport?.documents.some((d) => d.docType === "business_plan") ?? false,
  };

  const answers = submission.answers as Record<string, unknown>;
  const { uid } = extractSubmissionMeta(answers);
  const fileUrls = (submission.fileUrls as Record<string, FileInfo> | null) ?? null;
  const initialModifiedAnswers =
    (submission.modifiedAnswers as ModifiedAnswers | null) ?? {};

  let candidates: Array<{
    id: number;
    applicantName: string | null;
    statusName: string | null;
    vendorName: string | null;
    createdAt: string;
  }> = [];

  if (uid) {
    const lineFriend = await prisma.hojoLineFriendJoseiSupport.findUnique({
      where: { uid },
      select: {
        applicationSupports: {
          where: { deletedAt: null },
          include: {
            status: { select: { name: true } },
            vendor: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (lineFriend) {
      candidates = lineFriend.applicationSupports.map((a) => ({
        id: a.id,
        applicantName: a.applicantName,
        statusName: a.status?.name ?? null,
        vendorName: a.vendor?.name ?? null,
        createdAt: a.createdAt.toISOString(),
      }));
    }
  }

  return (
    <FormSubmissionEditClient
      submissionId={submission.id}
      answers={answers}
      initialModifiedAnswers={initialModifiedAnswers}
      fileUrls={fileUrls}
      submittedAt={submission.submittedAt.toISOString()}
      confirmedAt={submission.confirmedAt?.toISOString() ?? null}
      formTranscriptDate={
        submission.linkedApplicationSupport?.formTranscriptDate
          ?.toISOString()
          .slice(0, 10) ?? null
      }
      linkedApplicationSupportId={submission.linkedApplicationSupportId}
      uid={uid}
      applicationSupportCandidates={candidates}
      canEdit={canEdit}
      subsidyAmount={submission.linkedApplicationSupport?.subsidyAmount ?? null}
      existingDocTypes={existingDocTypes}
      appSupportAnyRunning={
        !!submission.linkedApplicationSupport?.trainingReportRunningAt ||
        !!submission.linkedApplicationSupport?.supportApplicationRunningAt ||
        !!submission.linkedApplicationSupport?.businessPlanRunningAt
      }
    />
  );
}
