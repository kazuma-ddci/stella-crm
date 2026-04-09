import { prisma } from "@/lib/prisma";
import { SubmissionsTable } from "./submissions-table";

export default async function HojoFormSubmissionsPage() {
  const submissions = await prisma.hojoFormSubmission.findMany({
    where: { deletedAt: null, formType: "business-plan" },
    orderBy: { submittedAt: "desc" },
  });

  const data = submissions.map((s) => {
    const answers = (s.answers as Record<string, string>) ?? {};
    return {
      id: s.id,
      tradeName: answers.tradeName || "（未入力）",
      contactPerson: answers.contactPerson || "",
      industry: answers.industry || "",
      phone: answers.mainPhone || "",
      bankType: answers.bankType || "",
      uid: answers._uid || "",
      submittedAt: s.submittedAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">フォーム回答一覧（仮）</h1>
      <SubmissionsTable data={data} />
    </div>
  );
}
