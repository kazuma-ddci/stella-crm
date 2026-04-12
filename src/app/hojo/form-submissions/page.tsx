import { prisma } from "@/lib/prisma";
import { SubmissionsTable } from "./submissions-table";

export default async function HojoFormSubmissionsPage() {
  const submissions = await prisma.hojoFormSubmission.findMany({
    where: { deletedAt: null, formType: "business-plan" },
    orderBy: { submittedAt: "desc" },
  });

  const data = submissions.map((s) => {
    const answers = s.answers as Record<string, unknown>;
    const meta = (answers?._meta as Record<string, string>) ?? {};
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
      uid: meta.uid || "",
      submittedAt: s.submittedAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">フォーム回答一覧</h1>
      <SubmissionsTable data={data} />
    </div>
  );
}
