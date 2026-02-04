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
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Edit,
  KeyRound,
  UserCheck,
  UserX,
} from "lucide-react";

interface DisplayView {
  id: number;
  viewKey: string;
  viewName: string;
  projectCode: string;
  description?: string | null;
}

interface ProjectWithViews {
  code: string;
  name: string;
  views: DisplayView[];
}

interface ExternalUser {
  id: number;
  name: string;
  email: string;
  position: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
  company: {
    id: number;
    name: string;
  };
  displayPermissions: {
    displayView: DisplayView;
  }[];
  approver?: {
    name: string;
  } | null;
}

export default function ExternalUsersPage() {
  const [users, setUsers] = useState<ExternalUser[]>([]);
  const [projects, setProjects] = useState<ProjectWithViews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] =
    useState(false);
  const [processing, setProcessing] = useState(false);

  // 編集フォームの状態
  const [editStatus, setEditStatus] = useState<"active" | "suspended">(
    "active"
  );
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedViewIds, setSelectedViewIds] = useState<number[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ユーザー一覧の取得に失敗しました");
      }

      setUsers(data.users);
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEditDialog = (user: ExternalUser) => {
    setSelectedUser(user);
    setEditStatus(user.status as "active" | "suspended");

    // 現在の権限からプロジェクトとビューを設定
    const currentViewIds = user.displayPermissions.map(
      (dp) => dp.displayView.id
    );
    setSelectedViewIds(currentViewIds);

    // プロジェクトを設定
    const currentProjectCodes = [
      ...new Set(
        user.displayPermissions.map((dp) => dp.displayView.projectCode)
      ),
    ];
    setSelectedProjects(currentProjectCodes);

    setIsEditDialogOpen(true);
  };

  const openResetPasswordDialog = (user: ExternalUser) => {
    setSelectedUser(user);
    setIsResetPasswordDialogOpen(true);
  };

  const handleProjectToggle = (projectCode: string, checked: boolean) => {
    let newSelectedProjects: string[];
    let newSelectedViewIds = [...selectedViewIds];

    if (checked) {
      newSelectedProjects = [...selectedProjects, projectCode];
    } else {
      newSelectedProjects = selectedProjects.filter((p) => p !== projectCode);
      // プロジェクトを外したら、そのプロジェクトのビューも外す
      const project = projects.find((p) => p.code === projectCode);
      if (project) {
        const viewIdsToRemove = project.views.map((v) => v.id);
        newSelectedViewIds = newSelectedViewIds.filter(
          (id) => !viewIdsToRemove.includes(id)
        );
      }
    }

    setSelectedProjects(newSelectedProjects);
    setSelectedViewIds(newSelectedViewIds);
  };

  const handleViewToggle = (viewId: number, checked: boolean) => {
    if (checked) {
      setSelectedViewIds([...selectedViewIds, viewId]);
    } else {
      setSelectedViewIds(selectedViewIds.filter((id) => id !== viewId));
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          viewIds: selectedViewIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "更新に失敗しました");
      }

      setSuccess("ユーザー情報を更新しました");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}/reset-password`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "パスワードリセットに失敗しました");
      }

      setSuccess(
        data.warning || "パスワードリセットメールを送信しました"
      );
      setIsResetPasswordDialogOpen(false);
      setSelectedUser(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "パスワードリセットに失敗しました"
      );
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">有効</Badge>;
      case "suspended":
        return <Badge variant="destructive">停止中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 成功メッセージを3秒後に消す
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

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
              <CardTitle>外部ユーザー管理</CardTitle>
              <CardDescription>
                外部ユーザーのステータスと権限を管理します
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

          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              外部ユーザーはいません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>企業名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>権限</TableHead>
                  <TableHead>最終ログイン</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.company.name}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.displayPermissions.map((dp) => (
                          <Badge
                            key={dp.displayView.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {dp.displayView.viewName}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("ja-JP")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openResetPasswordDialog(user)}
                        >
                          <KeyRound className="h-4 w-4 mr-1" />
                          PW
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

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ユーザー編集</DialogTitle>
            <DialogDescription>
              {selectedUser?.name}（{selectedUser?.company.name}）
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* ステータス */}
            <div className="space-y-2">
              <Label>ステータス</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-active"
                    checked={editStatus === "active"}
                    onCheckedChange={() => setEditStatus("active")}
                  />
                  <label
                    htmlFor="status-active"
                    className="text-sm cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="h-4 w-4 text-green-500" />
                    有効
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-suspended"
                    checked={editStatus === "suspended"}
                    onCheckedChange={() => setEditStatus("suspended")}
                  />
                  <label
                    htmlFor="status-suspended"
                    className="text-sm cursor-pointer flex items-center gap-1"
                  >
                    <UserX className="h-4 w-4 text-red-500" />
                    停止
                  </label>
                </div>
              </div>
            </div>

            <Separator />

            {/* 権限設定 */}
            <div className="space-y-3">
              <Label>表示権限</Label>

              {/* プロジェクト選択 */}
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  プロジェクト
                </span>
                <div className="space-y-2 pl-2">
                  {projects.map((project) => (
                    <div
                      key={project.code}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`project-${project.code}`}
                        checked={selectedProjects.includes(project.code)}
                        onCheckedChange={(checked) =>
                          handleProjectToggle(project.code, checked === true)
                        }
                      />
                      <label
                        htmlFor={`project-${project.code}`}
                        className="text-sm cursor-pointer"
                      >
                        {project.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* 表示区分選択 */}
              {selectedProjects.length > 0 && (
                <div className="space-y-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    表示区分
                  </span>
                  {projects
                    .filter((p) => selectedProjects.includes(p.code))
                    .map((project) => (
                      <div key={project.code} className="space-y-2 pl-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          【{project.name}】
                        </span>
                        <div className="space-y-2 pl-2">
                          {project.views.map((view) => (
                            <div
                              key={view.id}
                              className="flex items-start space-x-2"
                            >
                              <Checkbox
                                id={`view-${view.id}`}
                                checked={selectedViewIds.includes(view.id)}
                                onCheckedChange={(checked) =>
                                  handleViewToggle(view.id, checked === true)
                                }
                              />
                              <div className="grid gap-0.5 leading-none">
                                <label
                                  htmlFor={`view-${view.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {view.viewName}
                                </label>
                                {view.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {view.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button onClick={handleUpdate} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                "更新する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* パスワードリセットダイアログ */}
      <Dialog
        open={isResetPasswordDialogOpen}
        onOpenChange={setIsResetPasswordDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードリセット</DialogTitle>
            <DialogDescription>
              {selectedUser?.name}（{selectedUser?.email}
              ）にパスワードリセットメールを送信します。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsResetPasswordDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button onClick={handleResetPassword} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                "メールを送信"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
