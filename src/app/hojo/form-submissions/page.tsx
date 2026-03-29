import { prisma } from "@/lib/prisma";
import { SubmissionsTable } from "./submissions-table";

export default async function HojoFormSubmissionsPage() {
  const submissions = await prisma.hojoFormSubmission.findMany({
    where: { deletedAt: null, formType: "digital-promotion" },
    orderBy: { submittedAt: "desc" },
  });

  const data = submissions.map((s) => ({
    id: s.id,
    companyName: s.companyName || "（未入力）",
    representName: s.representName || "（未入力）",
    email: s.email || "",
    phone: s.phone || "",
    submittedAt: s.submittedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">フォーム回答一覧</h1>
      <SubmissionsTable data={data} />
    </div>
  );
}
