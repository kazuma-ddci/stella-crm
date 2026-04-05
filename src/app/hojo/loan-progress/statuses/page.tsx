import { prisma } from "@/lib/prisma";
import { StatusManagement } from "./status-management";

export default async function Page() {
  const statuses = await prisma.hojoLoanProgressStatus.findMany({
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">貸金ステータス管理</h1>
      <StatusManagement
        statuses={statuses.map((s) => ({
          id: s.id,
          name: s.name,
          displayOrder: s.displayOrder,
          isActive: s.isActive,
        }))}
      />
    </div>
  );
}
