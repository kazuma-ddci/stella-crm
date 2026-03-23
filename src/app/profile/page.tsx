import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarCustomizer } from "./sidebar-customizer";
import type { UserPermission } from "@/types/auth";
import { canView } from "@/lib/auth/permissions";
import type { ProjectCode } from "@/types/auth";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any;
  const userId = user.id as number;
  const permissions = (user.permissions ?? []) as UserPermission[];
  const organizationRole = user.organizationRole ?? "member";
  const isFounder = organizationRole === "founder";
  const isAdminUser = user.loginId === "admin";

  // サイドバー設定とプロジェクト一覧を並列取得
  const [pref, dbProjects] = await Promise.all([
    prisma.staffSidebarPreference.findUnique({
      where: { staffId: userId },
      select: { hiddenItems: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const hiddenItems = pref?.hiddenItems ?? [];

  // DBから取得したプロジェクト一覧をサイドバー設定に変換
  // 権限のあるプロジェクトのみ選択肢に表示
  const availableProjects = dbProjects.filter((p) => {
    if (isAdminUser || isFounder) return true;
    return canView(permissions, p.code as ProjectCode);
  }).map((p) => ({
    key: p.code,
    name: p.name,
    hidden: hiddenItems.includes(p.code),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">プロフィール設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">名前</dt>
              <dd className="text-sm">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">メールアドレス</dt>
              <dd className="text-sm">{user.email || "未設定"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>サイドバー表示設定</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            サイドバーに表示するプロジェクトを選択できます。非表示にしたプロジェクトはサイドバーから隠れますが、URLで直接アクセスは可能です。
          </p>
          <SidebarCustomizer projects={availableProjects} />
        </CardContent>
      </Card>
    </div>
  );
}
