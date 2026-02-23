import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listNotifications } from "./actions";
import { NotificationTable } from "./notification-table";

export default async function NotificationsPage() {
  const notifications = await listNotifications();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">通知</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>通知一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationTable notifications={notifications} />
        </CardContent>
      </Card>
    </div>
  );
}
