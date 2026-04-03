import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BbsClientPage } from "./bbs-client-page";
import { canEdit as canEditProject } from "@/lib/auth/permissions";
import type { UserPermission } from "@/types/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "支援金管理ページ",
};

export default async function BbsPage() {
  const session = await auth();
  const userType = session?.user?.userType;
  const isStaff = userType === "staff";
  const isBbs = userType === "bbs";
  const isAuthenticated = isStaff || isBbs;
  const userPermissions = (session?.user?.permissions ?? []) as UserPermission[];
  const staffCanEdit = isStaff && canEditProject(userPermissions, "hojo");

  if (!isAuthenticated) {
    return <BbsClientPage authenticated={false} isBbs={false} data={[]} />;
  }

  // BBSユーザーでmustChangePasswordの場合はリダイレクト（middlewareで制御されるがフォールバック）
  if (isBbs && session?.user?.mustChangePassword) {
    return <BbsClientPage authenticated={false} isBbs={false} data={[]} />;
  }

  const records = await prisma.hojoApplicationSupport.findMany({
    where: { deletedAt: null, formAnswerDate: { not: null }, lineFriend: { userType: "顧客" } },
    include: {
      lineFriend: true,
    },
    orderBy: { formAnswerDate: "asc" },
  });

  const data = records.map((r) => ({
    id: r.id,
    applicantName: r.applicantName || "-",
    formAnswerDate: r.formAnswerDate?.toISOString().slice(0, 10) ?? "-",
    bbsStatusId: r.bbsStatusId,
    bbsTransferAmount: r.bbsTransferAmount,
    bbsTransferDate: r.bbsTransferDate?.toISOString().slice(0, 10) ?? "-",
    subsidyReceivedDate: r.subsidyReceivedDate?.toISOString().slice(0, 10) ?? "-",
    alkesMemo: r.alkesMemo || "",
    bbsMemo: r.bbsMemo || "",
  }));

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

  return <BbsClientPage authenticated={true} isBbs={isBbs} canEdit={isBbs || staffCanEdit} data={data} userName={userName} bbsStatusOptions={bbsStatusOptions} />;
}
