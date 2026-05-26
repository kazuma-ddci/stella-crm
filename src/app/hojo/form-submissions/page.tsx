import { prisma } from "@/lib/prisma";
import { SubmissionsTable } from "./submissions-table";
import { extractSubmissionMeta } from "@/lib/hojo/form-answer-sections";

export default async function HojoFormSubmissionsPage() {
  const submissions = await prisma.hojoFormSubmission.findMany({
    where: { deletedAt: null, formType: "business-plan" },
    include: {
      linkedApplicationSupport: {
        select: {
          wholesaleAccountId: true,
          formUpdateStatus: true,
          formTranscriptDate: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const data = submissions.map((s) => {
    const answers = s.answers as Record<string, unknown>;
    const meta = extractSubmissionMeta(answers);
    const basic = (answers?.basic as Record<string, string>) ?? {};
    const bankAccount = (answers?.bankAccount as Record<string, string>) ?? {};

    return {
      id: s.id,
      tradeName: basic.tradeName || s.companyName || "（未入力）",
      fullName: basic.fullName || s.representName || "",
      phone: basic.phone || s.phone || "",
      email: basic.email || s.email || "",
      employeeCount: basic.employeeCount || "",
      bankType: bankAccount.bankType || "",
      wholesaleAccountId: s.linkedApplicationSupport?.wholesaleAccountId ?? meta.wholesaleAccountId,
      submittedAt: s.submittedAt.toISOString(),
      confirmedAt: s.confirmedAt?.toISOString() ?? null,
      linkStatus: s.linkedApplicationSupportId ? "linked" as const : "no-candidate" as const,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">情報回収フォーム回答</h1>
      <SubmissionsTable data={data} />
    </div>
  );
}
