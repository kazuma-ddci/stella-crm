import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { RemindersClient } from "./reminders-client";

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default async function SlpRemindersPage() {
  const session = await auth();
  const user = session?.user;

  if (!canEditProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true, reminderDays: true },
  });

  if (!slpProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">契約書リマインド管理</h1>
        <p className="text-muted-foreground">SLPプロジェクトが見つかりません。</p>
      </div>
    );
  }

  const reminderDays = slpProject.reminderDays;

  // 明日の日付を基準にリマインド対象を算出
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 明日からちょうどN日前の1日分（その日の00:00〜23:59）
  const targetDate = new Date(tomorrow);
  targetDate.setDate(targetDate.getDate() - reminderDays);

  const targetDateFrom = new Date(targetDate);
  targetDateFrom.setHours(0, 0, 0, 0);

  const targetDateTo = new Date(targetDate);
  targetDateTo.setHours(23, 59, 59, 999);

  // MasterContract経由で明日リマインド対象を抽出（除外済みも含む）
  const candidates = await prisma.masterContract.findMany({
    where: {
      projectId: slpProject.id,
      cloudsignStatus: "sent",
      cloudsignDocumentId: { not: null },
      cloudsignLastRemindedAt: null, // 未リマインド
      cloudsignSentAt: {
        gte: targetDateFrom,
        lte: targetDateTo,
      },
      slpMember: {
        deletedAt: null,
      },
    },
    include: {
      slpMember: {
        select: {
          id: true,
          name: true,
          email: true,
          reminderExcluded: true,
        },
      },
    },
    orderBy: { cloudsignSentAt: "asc" },
  });

  const members = candidates
    .filter((c) => c.slpMember)
    .map((c) => {
      const daysSinceSent = c.cloudsignSentAt
        ? Math.floor(
            (now.getTime() - c.cloudsignSentAt.getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      return {
        id: c.slpMember!.id,
        name: c.slpMember!.name,
        email: c.slpMember!.email,
        contractSentDate: formatDate(c.cloudsignSentAt),
        daysSinceSent,
        reminderExcluded: c.slpMember!.reminderExcluded,
      };
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約書リマインド管理</h1>
      <RemindersClient
        projectId={slpProject.id}
        reminderDays={reminderDays}
        members={members}
      />
    </div>
  );
}
