"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { updateReminderDays, toggleReminderExcluded } from "./actions";

type MemberRow = {
  id: number;
  name: string;
  email: string | null;
  contractSentDate: string;
  daysSinceSent: number | null;
  reminderExcluded: boolean;
};

type Props = {
  projectId: number;
  reminderDays: number;
  members: MemberRow[];
};

export function RemindersClient({ projectId, reminderDays, members }: Props) {
  const [days, setDays] = useState(String(reminderDays));
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const handleSaveDays = async () => {
    const parsed = parseInt(days, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 30) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const result = await updateReminderDays(projectId, parsed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleExcluded = async (memberId: number) => {
    setTogglingId(memberId);
    try {
      const result = await toggleReminderExcluded(memberId);
      if (!result.ok) {
        toast.error(result.error);
      }
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = members.filter((m) => !m.reminderExcluded).length;
  const excludedCount = members.filter((m) => m.reminderExcluded).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>リマインド日数設定</CardTitle>
          <CardDescription>
            契約書送付から何日後に自動リマインドを送るかを設定します。
            変更は次回のcron実行（毎日10時）から反映されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="reminder-days">送付からの日数</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="reminder-days"
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">日後</span>
              </div>
            </div>
            <Button
              onClick={handleSaveDays}
              disabled={saving || !days || parseInt(days, 10) < 1 || parseInt(days, 10) > 30}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-600">保存しました</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>明日のリマインド予定</CardTitle>
          <CardDescription>
            明日の自動リマインド（10時実行）で対象となるお客様の一覧です。
            {members.length > 0 && (
              <>
                {" "}対象: {activeCount}名
                {excludedCount > 0 && `（除外中: ${excludedCount}名）`}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              明日リマインド予定のお客様はいません
            </p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名前</TableHead>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>契約書送付日</TableHead>
                    <TableHead>経過日数</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow
                      key={member.id}
                      className={member.reminderExcluded ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email ?? "-"}</TableCell>
                      <TableCell>{member.contractSentDate}</TableCell>
                      <TableCell>
                        {member.daysSinceSent !== null
                          ? `${member.daysSinceSent}日`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {member.reminderExcluded ? (
                          <Badge variant="secondary">除外中</Badge>
                        ) : (
                          <Badge variant="default">送信予定</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={member.reminderExcluded ? "outline" : "destructive"}
                          size="sm"
                          disabled={togglingId === member.id}
                          onClick={() => handleToggleExcluded(member.id)}
                        >
                          {togglingId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : member.reminderExcluded ? (
                            <>
                              <Bell className="h-4 w-4 mr-1" />
                              除外解除
                            </>
                          ) : (
                            <>
                              <BellOff className="h-4 w-4 mr-1" />
                              除外
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
