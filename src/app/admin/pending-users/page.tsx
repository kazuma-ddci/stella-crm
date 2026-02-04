"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface TokenDefaultView {
  displayView: {
    id: number;
    viewKey: string;
    viewName: string;
    projectCode: string;
  };
}

interface ExternalUser {
  id: number;
  name: string;
  email: string;
  position: string | null;
  status: string;
  createdAt: string;
  emailVerifiedAt: string | null;
  company: {
    id: number;
    name: string;
  };
  registrationToken?: {
    defaultViews: TokenDefaultView[];
  } | null;
}

interface DisplayView {
  id: number;
  viewKey: string;
  viewName: string;
  projectCode: string;
}

export default function PendingUsersPage() {
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [views, setViews] = useState<DisplayView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [selectedViews, setSelectedViews] = useState<number[]>([]);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/users/pending");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ユーザー一覧の取得に失敗しました");
      }

      setUsers(data.users);
      setViews(data.views);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewIds: selectedViews }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "承認に失敗しました");
      }

      setIsApproveDialogOpen(false);
      setSelectedUser(null);
      setSelectedViews([]);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/reject`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "却下に失敗しました");
      }

      setIsRejectDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "却下に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const openApproveDialog = (user: ExternalUser) => {
    setSelectedUser(user);
    // トークンのデフォルトビューがあれば初期選択として設定
    const defaultViewIds =
      user.registrationToken?.defaultViews?.map(
        (dv) => dv.displayView.id
      ) || [];
    setSelectedViews(defaultViewIds);
    setIsApproveDialogOpen(true);
  };

  const openRejectDialog = (user: ExternalUser) => {
    setSelectedUser(user);
    setIsRejectDialogOpen(true);
  };

  const toggleViewSelection = (viewId: number) => {
    setSelectedViews((prev) =>
      prev.includes(viewId)
        ? prev.filter((id) => id !== viewId)
        : [...prev, viewId]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_email":
        return <Badge variant="secondary">メール未認証</Badge>;
      case "pending_approval":
        return <Badge variant="default">承認待ち</Badge>;
      case "active":
        return <Badge className="bg-green-500">有効</Badge>;
      case "suspended":
        return <Badge variant="destructive">停止中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>承認待ちユーザー管理</CardTitle>
              <CardDescription>
                外部ユーザーの登録申請を承認または却下します
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              更新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              承認待ちのユーザーはいません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>企業名</TableHead>
                  <TableHead>役職</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>登録日時</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.company.name}</TableCell>
                    <TableCell>{user.position || "-"}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => openApproveDialog(user)}
                          disabled={user.status !== "pending_approval"}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(user)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          却下
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 承認ダイアログ */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを承認</DialogTitle>
            <DialogDescription>
              {selectedUser?.name}（{selectedUser?.company.name}
              ）を承認します。
              付与する表示権限を選択してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="font-medium">表示権限</div>
            {selectedUser?.registrationToken?.defaultViews &&
              selectedUser.registrationToken.defaultViews.length > 0 && (
                <Alert>
                  <AlertDescription>
                    トークン発行時のデフォルト権限が選択されています。必要に応じて変更してください。
                  </AlertDescription>
                </Alert>
              )}
            <div className="space-y-2">
              {views.map((view) => (
                <div key={view.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`view-${view.id}`}
                    checked={selectedViews.includes(view.id)}
                    onCheckedChange={() => toggleViewSelection(view.id)}
                  />
                  <label
                    htmlFor={`view-${view.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {view.viewName}
                    <span className="text-gray-500 ml-2">
                      ({view.projectCode})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing || selectedViews.length === 0}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  処理中...
                </>
              ) : (
                "承認する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 却下ダイアログ */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザーを却下</DialogTitle>
            <DialogDescription>
              {selectedUser?.name}（{selectedUser?.company.name}
              ）の登録申請を却下します。 この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  処理中...
                </>
              ) : (
                "却下する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
