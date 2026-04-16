import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/staff-action";
import { isFounder, isSystemAdmin } from "@/lib/auth/permissions";
import { ZoomSelfConnectCard, OtherStaffZoomList } from "./zoom-connect-client";
import Link from "next/link";
import { BookOpen } from "lucide-react";

type SearchParams = Promise<{ zoomResult?: string; reason?: string }>;

export default async function StaffMeIntegrationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireStaff();
  const sp = await searchParams;

  const [mine, others] = await Promise.all([
    prisma.staffMeetingIntegration.findUnique({
      where: { staffId_provider: { staffId: user.id, provider: "zoom" } },
    }),
    // 他スタッフの連携状況（閲覧は全員可能、解除は後段で権限判定）
    prisma.masterStaff.findMany({
      where: { isSystemUser: false, isActive: true, id: { not: user.id } },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      include: {
        meetingIntegrations: {
          where: { provider: "zoom" },
          select: {
            connectedAt: true,
            disconnectedAt: true,
            externalEmail: true,
          },
        },
      },
    }),
  ]);

  const isSlpManager =
    isSystemAdmin(user) ||
    isFounder(user) ||
    (user.permissions ?? []).some(
      (p) => p.projectCode === "slp" && p.permissionLevel === "manager"
    );

  const selfConnected = !!mine && !mine.disconnectedAt;

  const otherRows = others.map((s) => {
    const z = s.meetingIntegrations[0];
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      connectedAt: z?.connectedAt ?? null,
      disconnectedAt: z?.disconnectedAt ?? null,
      externalEmail: z?.externalEmail ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ミーティング連携</h1>
        <Link
          href="/staff/me/integrations/guide"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <BookOpen className="h-4 w-4" /> 連携ガイドを開く
        </Link>
      </div>

      <ZoomSelfConnectCard
        isSelfConnected={selfConnected}
        selfEmail={mine?.externalEmail ?? null}
        selfDisplayName={mine?.externalDisplayName ?? null}
        showSuccess={sp.zoomResult === "success"}
        errorReason={sp.zoomResult === "error" ? (sp.reason ?? "不明") : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>他スタッフの連携状況</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            他スタッフの連携は本人のみが実施できます。
            {isSlpManager
              ? " SLPマネージャー権限のあなたは、必要に応じて他スタッフの連携を解除できます。"
              : ""}
          </p>
          <OtherStaffZoomList rows={otherRows} canDisconnect={isSlpManager} />
        </CardContent>
      </Card>
    </div>
  );
}
