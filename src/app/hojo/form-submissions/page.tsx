import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import { SubmissionsTable } from "./submissions-table";
import { LinkSelectorBanner, type UnlinkedSubmission } from "./link-selector";
import { extractSubmissionMeta } from "@/lib/hojo/form-answer-sections";

export default async function HojoFormSubmissionsPage() {
  const session = await auth();
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const canEdit =
    session?.user?.userType === "staff" && canEditProject(userPermissions, "hojo");

  const submissions = await prisma.hojoFormSubmission.findMany({
    where: { deletedAt: null, formType: "business-plan" },
    orderBy: { submittedAt: "desc" },
  });

  const uids = new Set<string>();
  for (const s of submissions) {
    const { uid } = extractSubmissionMeta(s.answers as Record<string, unknown>);
    if (uid) uids.add(uid);
  }

  const lineFriends = await prisma.hojoLineFriendJoseiSupport.findMany({
    where: { uid: { in: Array.from(uids) } },
    select: {
      id: true,
      uid: true,
      applicationSupports: {
        where: { deletedAt: null },
        select: {
          id: true,
          applicantName: true,
          createdAt: true,
          status: { select: { name: true } },
          vendor: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const candidatesByUid = new Map<string, {
    id: number;
    applicantName: string | null;
    statusName: string | null;
    vendorName: string | null;
    createdAt: string;
  }[]>();
  for (const lf of lineFriends) {
    candidatesByUid.set(
      lf.uid,
      lf.applicationSupports.map((a) => ({
        id: a.id,
        applicantName: a.applicantName,
        statusName: a.status?.name ?? null,
        vendorName: a.vendor?.name ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    );
  }

  const unlinked: UnlinkedSubmission[] = [];
  for (const s of submissions) {
    if (s.linkedApplicationSupportId) continue;
    const { uid } = extractSubmissionMeta(s.answers as Record<string, unknown>);
    if (!uid) continue;
    const candidates = candidatesByUid.get(uid) ?? [];
    if (candidates.length < 2) continue;
    const basic = (s.answers as Record<string, unknown>)?.basic as Record<string, string> | undefined;
    unlinked.push({
      id: s.id,
      tradeName: basic?.tradeName || s.companyName || "",
      fullName: basic?.fullName || s.representName || "",
      submittedAt: s.submittedAt.toISOString(),
      uid,
      candidates,
    });
  }

  const data = submissions.map((s) => {
    const answers = s.answers as Record<string, unknown>;
    const { uid } = extractSubmissionMeta(answers);
    const basic = (answers?.basic as Record<string, string>) ?? {};
    const bankAccount = (answers?.bankAccount as Record<string, string>) ?? {};

    const candidates = uid ? (candidatesByUid.get(uid) ?? []) : [];
    let linkStatus: "linked" | "multi-unlinked" | "no-candidate";
    if (s.linkedApplicationSupportId) linkStatus = "linked";
    else if (candidates.length > 1) linkStatus = "multi-unlinked";
    else linkStatus = "no-candidate";

    return {
      id: s.id,
      tradeName: basic.tradeName || s.companyName || "（未入力）",
      fullName: basic.fullName || s.representName || "",
      phone: basic.phone || s.phone || "",
      email: basic.email || s.email || "",
      employeeCount: basic.employeeCount || "",
      bankType: bankAccount.bankType || "",
      uid: uid ?? "",
      submittedAt: s.submittedAt.toISOString(),
      confirmedAt: s.confirmedAt?.toISOString() ?? null,
      linkStatus,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">情報回収フォーム回答</h1>
      <LinkSelectorBanner unlinked={unlinked} canEdit={canEdit} />
      <SubmissionsTable data={data} />
    </div>
  );
}
