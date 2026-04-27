import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { LoanSubmissionsClient } from "./loan-submissions-client";
import { LenderShareableUrlCard } from "@/components/lender-shareable-url-card";

export default async function HojoLoanSubmissionsPage() {
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEdit = canEditProject(userPermissions, "hojo");

  const allSubmissions = await prisma.hojoFormSubmission.findMany({
    where: {
      deletedAt: null,
      formType: { in: ["loan-corporate", "loan-individual"] },
    },
    orderBy: { submittedAt: "desc" },
  });

  const mapRow = (s: typeof allSubmissions[number]) => {
    const answers = s.answers as Record<string, unknown>;
    return {
      id: s.id,
      formType: s.formType,
      companyName: s.companyName || "（未入力）",
      representName: s.representName || "（未入力）",
      email: s.email || "",
      phone: s.phone || "",
      vendorName: (answers?._vendorName as string) || "",
      submittedAt: s.submittedAt.toISOString(),
      vendorMemo: s.vendorMemo || "",
      lenderMemo: s.lenderMemo || "",
      staffMemo: s.staffMemo || "",
      answers: answers ?? {},
      modifiedAnswers: (s.modifiedAnswers as Record<string, unknown> | null) ?? null,
    };
  };

  const corporateData = allSubmissions
    .filter((s) => s.formType === "loan-corporate")
    .map(mapRow);
  const individualData = allSubmissions
    .filter((s) => s.formType === "loan-individual")
    .map(mapRow);

  // ベンダー一覧（フィルタ用）
  const vendors = await prisma.hojoVendor.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">借入申込フォーム回答</h1>
      <LenderShareableUrlCard />
      <LoanSubmissionsClient
        corporateData={corporateData}
        individualData={individualData}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
        canEdit={canEdit}
      />
    </div>
  );
}
