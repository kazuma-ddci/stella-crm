import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/staff-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Calendar, Video, MessageCircle, Send } from "lucide-react";

/**
 * スタッフ本人の外部サービス連携（Google/Zoom/Slack/Telegram）状態表示ページ。
 *
 * 表示のみ。実際のOAuthフロー/ボット紐付けは各機能実装時に追加予定。
 * - Google連携 → Googleカレンダー + Google Meet 兼用
 * - Zoom連携  → 未連携スタッフは Meet 利用に自動切替
 * - Slack紐付け → Slackボットから接触履歴作成時の識別
 * - Telegram紐付け → 同上 Telegram版
 */
export default async function StaffMeConnectionsPage() {
  const user = await requireStaff();

  const [googleAuth, zoomAuth, slackLink, telegramLink] = await Promise.all([
    prisma.staffGoogleAuth.findUnique({ where: { staffId: user.id } }),
    prisma.staffZoomAuth.findUnique({ where: { staffId: user.id } }),
    prisma.staffSlackLink.findUnique({ where: { staffId: user.id } }),
    prisma.staffTelegramLink.findUnique({ where: { staffId: user.id } }),
  ]);

  const isGoogleLinked = googleAuth !== null && googleAuth.revokedAt === null;
  const isZoomLinked = zoomAuth !== null && zoomAuth.revokedAt === null;
  const isSlackLinked = slackLink !== null && slackLink.revokedAt === null;
  const isTelegramLinked = telegramLink !== null && telegramLink.revokedAt === null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">外部サービス連携</h1>
        <p className="mt-1 text-sm text-gray-600">
          接触履歴の自動化（予定作成・カレンダー同期・通知）に使用する個人アカウントの連携状態。
          連携は任意ですが、連携済みスタッフのみが Zoom/Meet のホストとして自動API連携を使えます。
        </p>
      </div>

      <div className="rounded border bg-amber-50 p-3 text-sm text-amber-900">
        ⚠ 実際の連携フロー（OAuth認可・ボット紐付け）は現在実装準備中です。
        現状はデータ構造のみ先行配置され、全てのスタッフが未連携状態で表示されます。
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConnectionCard
          icon={<Calendar className="h-5 w-5" />}
          title="Google連携"
          description="Googleカレンダー + Google Meet の自動化に使用します。接触予定を自動でカレンダーに作成し、Meet会議URLを生成します。"
          linked={isGoogleLinked}
          subtitle={isGoogleLinked ? googleAuth?.googleEmail : undefined}
          linkedAt={isGoogleLinked ? googleAuth?.linkedAt : undefined}
        />
        <ConnectionCard
          icon={<Video className="h-5 w-5" />}
          title="Zoom連携"
          description="Zoom会議の自動生成・録画/議事録自動取得に使用します。未連携の場合はホスト指定時に自動で Google Meet に切替わります。"
          linked={isZoomLinked}
          subtitle={isZoomLinked ? zoomAuth?.zoomEmail : undefined}
          linkedAt={isZoomLinked ? zoomAuth?.linkedAt : undefined}
        />
        <ConnectionCard
          icon={<MessageCircle className="h-5 w-5" />}
          title="Slack紐付け"
          description="Slackボットから「接触履歴作成」「リマインダー」等の操作を利用する際の本人識別に使用します。"
          linked={isSlackLinked}
          subtitle={isSlackLinked ? `@${slackLink?.slackDisplayName ?? slackLink?.slackUserId}` : undefined}
          linkedAt={isSlackLinked ? slackLink?.linkedAt : undefined}
        />
        <ConnectionCard
          icon={<Send className="h-5 w-5" />}
          title="Telegram紐付け"
          description="Telegramボットから接触履歴を操作する際の本人識別に使用します。Slackと併用可能です。"
          linked={isTelegramLinked}
          subtitle={isTelegramLinked ? `@${telegramLink?.telegramUsername ?? telegramLink?.telegramUserId}` : undefined}
          linkedAt={isTelegramLinked ? telegramLink?.linkedAt : undefined}
        />
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-gray-500">
          既存のZoom連携（レガシー）の管理は{" "}
          <Link href="/staff/me/integrations" className="text-blue-600 hover:underline">
            こちら
          </Link>
          からアクセスできます。
        </p>
      </div>
    </div>
  );
}

function ConnectionCard({
  icon,
  title,
  description,
  linked,
  subtitle,
  linkedAt,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  linked: boolean;
  subtitle?: string | null;
  linkedAt?: Date | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
          <Badge variant={linked ? "default" : "outline"}>
            {linked ? "連携済" : "未連携"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {linked ? (
          <div className="space-y-1 text-sm">
            {subtitle && (
              <div>
                <span className="text-gray-500">アカウント: </span>
                <span className="font-medium">{subtitle}</span>
              </div>
            )}
            {linkedAt && (
              <div>
                <span className="text-gray-500">連携日時: </span>
                {linkedAt.toLocaleString("ja-JP")}
              </div>
            )}
            <div className="pt-2">
              <Button variant="outline" size="sm" disabled title="近日対応">
                解除する
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button size="sm" disabled title="近日対応">
              連携する
            </Button>
            <p className="mt-2 text-xs text-gray-500">
              認可フローは準備中です
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
