import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Briefcase, Phone, Users } from "lucide-react";
import { getTargetTypeLabel } from "@/lib/contact-history-v2/types";

export default async function DashboardPage() {
  const [companiesCount, stpCompaniesCount, contactsCount, agentsCount, recentContacts] =
    await Promise.all([
      prisma.masterStellaCompany.count({ where: { deletedAt: null } }),
      prisma.stpCompany.count(),
      // 全プロジェクト横断の接触履歴件数 (V2)
      prisma.contactHistoryV2.count({ where: { deletedAt: null } }),
      prisma.stpAgent.count(),
      // 最近の接触履歴 5件 (V2)
      prisma.contactHistoryV2.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { scheduledStartAt: "desc" },
        include: {
          project: { select: { name: true } },
          contactMethod: { select: { name: true } },
          customerParticipants: {
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
            take: 1,
          },
          staffParticipants: {
            include: { staff: { select: { name: true } } },
            take: 3,
          },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">ダッシュボード</h1>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全顧客数</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companiesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STP企業</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stpCompaniesCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">代理店</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接触履歴</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contactsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近の接触履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {recentContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">接触履歴がありません</p>
          ) : (
            <div className="space-y-4">
              {recentContacts.map((contact) => {
                const primary = contact.customerParticipants[0];
                const customerLabel = primary
                  ? getTargetTypeLabel(primary.targetType)
                  : "—";
                const staffNames = contact.staffParticipants
                  .map((p) => p.staff.name)
                  .join(", ");

                return (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {contact.title ?? `${contact.project.name} 接触履歴 #${contact.id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {customerLabel} - {contact.contactMethod?.name || "-"} -{" "}
                        {staffNames || "-"}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(contact.scheduledStartAt).toLocaleDateString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
