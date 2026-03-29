"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Settings,
} from "lucide-react";
import {
  addProjectEmail,
  updateEmailSmtp,
  updateProjectEmailMemo,
  deleteProjectEmail,
} from "./actions";

// ============================================
// 型定義
// ============================================

type ProjectEmailRecord = {
  id: number;
  projectId: number;
  projectName: string;
  projectCode: string;
  emailId: number;
  email: string;
  emailLabel: string | null;
  memo: string | null;
  isDefault: boolean;
  operatingCompanyId: number | null;
  operatingCompanyName: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPass: boolean;
  hasSmtpConfig: boolean;
};

type Project = {
  id: number;
  name: string;
  code: string;
  operatingCompanyId: number | null;
};

type Props = {
  initialProjectEmails: ProjectEmailRecord[];
  projects: Project[];
  isSystemAdmin: boolean; // loginId === "admin" のユーザーのみtrue
};

// ============================================
// メインコンポーネント
// ============================================

export function EmailSettingsClient({
  initialProjectEmails,
  projects,
  isSystemAdmin,
}: Props) {
  const router = useRouter();
  const [projectEmails, setProjectEmails] = useState(initialProjectEmails);

  // サーバー再取得後にpropsが更新されたらstateも同期
  useEffect(() => {
    setProjectEmails(initialProjectEmails);
  }, [initialProjectEmails]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // サーバーデータ再取得（クライアントstateを維持したまま）
  const refreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  // 選択中のプロジェクト（タブ）
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projects[0]?.id ?? null
  );

  // メール追加ダイアログ
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    memo: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpPass: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  // SMTP編集ダイアログ（adminのみ）
  const [isSmtpDialogOpen, setIsSmtpDialogOpen] = useState(false);
  const [editingPe, setEditingPe] = useState<ProjectEmailRecord | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: "",
    smtpPort: "",
    smtpPass: "",
  });
  const [smtpSaving, setSmtpSaving] = useState(false);

  // メモ編集
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoValue, setMemoValue] = useState("");

  const clearMessages = () => {
    setTimeout(() => { setSuccess(null); setError(null); }, 3000);
  };

  // プロジェクトごとにグループ化
  const emailsByProject = useMemo(() => {
    const map = new Map<number, ProjectEmailRecord[]>();
    for (const pe of projectEmails) {
      const list = map.get(pe.projectId) ?? [];
      list.push(pe);
      map.set(pe.projectId, list);
    }
    return map;
  }, [projectEmails]);

  const currentProjectEmails = selectedProjectId
    ? emailsByProject.get(selectedProjectId) ?? []
    : [];

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // ============================================
  // メール追加
  // ============================================

  const openAddDialog = () => {
    setAddForm({
      email: "",
      memo: "",
      smtpHost: "smtp.gmail.com",
      smtpPort: "587",
      smtpPass: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleAdd = async () => {
    if (!selectedProjectId || !addForm.email) return;
    setAddSaving(true);
    setError(null);

    try {
      const emailAddr = addForm.email.trim();
      const result = await addProjectEmail({
        projectId: selectedProjectId,
        email: emailAddr,
        memo: addForm.memo.trim() || null,
        smtpHost: addForm.smtpHost.trim() || "smtp.gmail.com",
        smtpPort: addForm.smtpPort ? parseInt(addForm.smtpPort) : 587,
        smtpUser: emailAddr, // ユーザー名 = メールアドレス
        smtpPass: addForm.smtpPass.trim() || null,
        isDefault: false,
      });

      if (!result.success) {
        setError(result.error ?? "追加に失敗しました");
        return;
      }

      setSuccess("メールアドレスを追加しました");
      setIsAddDialogOpen(false);
      clearMessages();
      refreshData();
    } catch {
      setError("追加に失敗しました");
    } finally {
      setAddSaving(false);
    }
  };

  // ============================================
  // SMTP編集（adminのみ）
  // ============================================

  const openSmtpDialog = (pe: ProjectEmailRecord) => {
    setEditingPe(pe);
    setSmtpForm({
      smtpHost: pe.smtpHost ?? "smtp.gmail.com",
      smtpPort: pe.smtpPort?.toString() ?? "587",
      smtpPass: "",
    });
    setIsSmtpDialogOpen(true);
  };

  const handleSmtpSave = async () => {
    if (!editingPe) return;
    setSmtpSaving(true);
    setError(null);

    try {
      await updateEmailSmtp(editingPe.emailId, {
        smtpHost: smtpForm.smtpHost.trim() || null,
        smtpPort: smtpForm.smtpPort ? parseInt(smtpForm.smtpPort) : null,
        smtpUser: editingPe.email, // ユーザー名 = メールアドレス
        smtpPass: smtpForm.smtpPass.trim() || null,
      });
      setSuccess("SMTP設定を更新しました");
      setIsSmtpDialogOpen(false);
      clearMessages();
      refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSmtpSaving(false);
    }
  };

  // ============================================
  // メモ編集
  // ============================================

  const handleMemoSave = async (peId: number) => {
    try {
      await updateProjectEmailMemo(peId, memoValue.trim() || null);
      setProjectEmails((prev) =>
        prev.map((item) =>
          item.id === peId ? { ...item, memo: memoValue.trim() || null } : item
        )
      );
      setEditingMemoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "メモの更新に失敗しました");
    }
  };

  // ============================================
  // 削除
  // ============================================

  const handleDelete = async (pe: ProjectEmailRecord) => {
    if (!confirm(`${pe.email} をこのプロジェクトから削除しますか？`)) return;
    try {
      await deleteProjectEmail(pe.id);
      setProjectEmails((prev) => prev.filter((item) => item.id !== pe.id));
      setSuccess("削除しました");
      clearMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  // ============================================
  // レンダリング
  // ============================================

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">メール設定</h1>
        <p className="text-muted-foreground mt-1">
          プロジェクトごとにメールアドレスとSMTP設定を管理します
        </p>
      </div>

      {/* 通知メッセージ */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* プロジェクトタブ */}
      <div className="flex gap-1 border-b">
        {projects.map((project) => {
          const count = emailsByProject.get(project.id)?.length ?? 0;
          return (
            <button
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                selectedProjectId === project.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              }`}
            >
              {project.name}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {count}件
              </span>
            </button>
          );
        })}
      </div>

      {/* 選択プロジェクトのメールアドレス */}
      {selectedProject && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedProject.name}
                  <span className="text-muted-foreground text-sm font-normal ml-2">
                    ({selectedProject.code})
                  </span>
                </CardTitle>
                <CardDescription>
                  このプロジェクトで使用するメールアドレスを管理します
                </CardDescription>
              </div>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-1" />
                メールアドレスを追加
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {currentProjectEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>メールアドレスが登録されていません</p>
                <p className="text-sm mt-1">
                  「メールアドレスを追加」から登録してください
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>メールアドレス</TableHead>
                    <TableHead>メモ</TableHead>
                    <TableHead>送信設定</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentProjectEmails.map((pe) => (
                    <TableRow key={pe.id}>
                      <TableCell>
                        <div className="font-mono text-sm">{pe.email}</div>
                      </TableCell>
                      <TableCell>
                        {editingMemoId === pe.id ? (
                          <div className="flex gap-1">
                            <Input
                              value={memoValue}
                              onChange={(e) => setMemoValue(e.target.value)}
                              className="h-7 text-sm"
                              placeholder="メモを入力"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleMemoSave(pe.id);
                                if (e.key === "Escape") setEditingMemoId(null);
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleMemoSave(pe.id)}
                            >
                              保存
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-left hover:text-primary cursor-pointer"
                            onClick={() => {
                              setEditingMemoId(pe.id);
                              setMemoValue(pe.memo ?? "");
                            }}
                          >
                            {pe.memo || (
                              <span className="text-muted-foreground italic">
                                クリックしてメモを追加
                              </span>
                            )}
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        {pe.hasSmtpConfig ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            送信可能
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-500 border-orange-300">
                            未設定
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isSystemAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => openSmtpDialog(pe)}
                            >
                              <Settings className="h-3 w-3 mr-1" />
                              SMTP
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(pe)}
                          >
                            <Trash2 className="h-3 w-3" />
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
      )}

      {/* メールアドレス追加ダイアログ */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>メールアドレスを追加</DialogTitle>
            <DialogDescription>
              {selectedProject?.name} にメールアドレスを追加します
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>メールアドレス *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="example@stella.co.jp"
              />
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Input
                value={addForm.memo}
                onChange={(e) => setAddForm({ ...addForm, memo: e.target.value })}
                placeholder="例: STP請求書送付用"
              />
            </div>

            {/* SMTP設定はadminのみ表示 */}
            {isSystemAdmin && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">SMTP設定（メール送信に必要）</p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">SMTPホスト</Label>
                      <Input
                        value={addForm.smtpHost}
                        onChange={(e) => setAddForm({ ...addForm, smtpHost: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">ポート</Label>
                      <Input
                        type="number"
                        value={addForm.smtpPort}
                        onChange={(e) => setAddForm({ ...addForm, smtpPort: e.target.value })}
                        placeholder="587"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">アプリパスワード</Label>
                    <Input
                      type="password"
                      value={addForm.smtpPass}
                      onChange={(e) => setAddForm({ ...addForm, smtpPass: e.target.value })}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Gmailの場合はアプリパスワード（16文字）を入力
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addSaving || !addForm.email}
            >
              {addSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />追加中...</>
              ) : (
                "追加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMTP設定編集ダイアログ（adminのみ） */}
      {isSystemAdmin && (
        <Dialog open={isSmtpDialogOpen} onOpenChange={setIsSmtpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>SMTP設定</DialogTitle>
              <DialogDescription>
                {editingPe?.email} の送信設定を編集します
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTPホスト</Label>
                  <Input
                    value={smtpForm.smtpHost}
                    onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ポート</Label>
                  <Input
                    type="number"
                    value={smtpForm.smtpPort}
                    onChange={(e) => setSmtpForm({ ...smtpForm, smtpPort: e.target.value })}
                    placeholder="587"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>アプリパスワード</Label>
                <Input
                  type="password"
                  value={smtpForm.smtpPass}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtpPass: e.target.value })}
                  placeholder={editingPe?.hasSmtpPass ? "変更する場合のみ入力" : "xxxx xxxx xxxx xxxx"}
                />
                {editingPe?.hasSmtpPass && (
                  <p className="text-xs text-muted-foreground">
                    現在設定済みです。変更する場合のみ入力してください。
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSmtpDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSmtpSave} disabled={smtpSaving}>
                {smtpSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</>
                ) : (
                  "保存"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
