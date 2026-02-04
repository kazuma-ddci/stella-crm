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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Plus,
  Copy,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { CompanySearchCombobox } from "@/components/company-search-combobox";

interface DisplayView {
  id: number;
  viewKey: string;
  viewName: string;
  projectCode: string;
  description: string | null;
}

interface ProjectWithViews {
  code: string;
  name: string;
  views: DisplayView[];
}

interface RegistrationToken {
  id: number;
  token: string;
  name: string | null;
  note: string | null;
  status: string;
  maxUses: number;
  useCount: number;
  expiresAt: string;
  createdAt: string;
  company: {
    id: number;
    name: string;
  };
  issuer: {
    name: string;
  };
  defaultViews?: {
    displayView: DisplayView;
  }[];
}

interface Company {
  id: number;
  companyCode: string;
  name: string;
  industry?: string | null;
}

export default function RegistrationTokensPage() {
  const [tokens, setTokens] = useState<RegistrationToken[]>([]);
  const [projects, setProjects] = useState<ProjectWithViews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newToken, setNewToken] = useState<{
    token: string;
    registerUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    companyId: null as number | null,
    name: "",
    note: "",
    maxUses: "1",
    expiresInDays: "7",
    selectedProjects: [] as string[],
    selectedViewIds: [] as number[],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tokensRes, viewsRes] = await Promise.all([
        fetch("/api/admin/registration-tokens"),
        fetch("/api/admin/display-views"),
      ]);

      const tokensData = await tokensRes.json();
      const viewsData = await viewsRes.json();

      if (!tokensRes.ok) {
        throw new Error(tokensData.error || "トークン一覧の取得に失敗しました");
      }

      setTokens(tokensData.tokens);
      setProjects(viewsData.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateToken = async () => {
    if (!formData.companyId) {
      setError("企業を選択してください");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/registration/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: formData.companyId,
          name: formData.name || undefined,
          note: formData.note || undefined,
          maxUses: parseInt(formData.maxUses, 10),
          expiresInDays: parseInt(formData.expiresInDays, 10),
          defaultViewIds:
            formData.selectedViewIds.length > 0
              ? formData.selectedViewIds
              : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "トークンの発行に失敗しました");
      }

      setNewToken({
        token: data.token.token,
        registerUrl: data.token.registerUrl,
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTokenUrl = async (token: RegistrationToken) => {
    const url = `${window.location.origin}/register/${token.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedTokenId(token.id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const getRegisterUrl = (token: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/register/${token}`;
    }
    return `/register/${token}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">有効</Badge>;
      case "expired":
        return <Badge variant="secondary">期限切れ</Badge>;
      case "exhausted":
        return <Badge variant="outline">使用済み</Badge>;
      case "revoked":
        return <Badge variant="destructive">無効化</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setNewToken(null);
    setFormData({
      companyId: null,
      name: "",
      note: "",
      maxUses: "1",
      expiresInDays: "7",
      selectedProjects: [],
      selectedViewIds: [],
    });
  };

  const handleCompanyChange = (
    companyId: number | null,
    _company: Company | null
  ) => {
    setFormData({ ...formData, companyId });
  };

  const handleProjectToggle = (projectCode: string, checked: boolean) => {
    let newSelectedProjects: string[];
    let newSelectedViewIds = [...formData.selectedViewIds];

    if (checked) {
      newSelectedProjects = [...formData.selectedProjects, projectCode];
    } else {
      newSelectedProjects = formData.selectedProjects.filter(
        (p) => p !== projectCode
      );
      // プロジェクトを外したら、そのプロジェクトのビューも外す
      const project = projects.find((p) => p.code === projectCode);
      if (project) {
        const viewIdsToRemove = project.views.map((v) => v.id);
        newSelectedViewIds = newSelectedViewIds.filter(
          (id) => !viewIdsToRemove.includes(id)
        );
      }
    }

    setFormData({
      ...formData,
      selectedProjects: newSelectedProjects,
      selectedViewIds: newSelectedViewIds,
    });
  };

  const handleViewToggle = (viewId: number, checked: boolean) => {
    let newSelectedViewIds: number[];

    if (checked) {
      newSelectedViewIds = [...formData.selectedViewIds, viewId];
    } else {
      newSelectedViewIds = formData.selectedViewIds.filter(
        (id) => id !== viewId
      );
    }

    setFormData({
      ...formData,
      selectedViewIds: newSelectedViewIds,
    });
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
              <CardTitle>登録トークン管理</CardTitle>
              <CardDescription>
                外部ユーザー登録用の招待トークンを管理します
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                更新
              </Button>
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                トークン発行
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {tokens.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              登録トークンはありません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>管理名</TableHead>
                  <TableHead>企業名</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>登録URL</TableHead>
                  <TableHead>使用回数</TableHead>
                  <TableHead>デフォルト権限</TableHead>
                  <TableHead>有効期限</TableHead>
                  <TableHead>発行者</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead>発行日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow
                    key={token.id}
                    className={
                      token.status !== "active"
                        ? "bg-muted/30 opacity-70"
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      {token.name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{token.company.name}</TableCell>
                    <TableCell>{getStatusBadge(token.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code
                          className={`text-xs px-2 py-1 rounded max-w-[200px] truncate ${
                            token.status === "active"
                              ? "bg-muted"
                              : "bg-muted/50 text-muted-foreground line-through opacity-60"
                          }`}
                        >
                          {getRegisterUrl(token.token)}
                        </code>
                        {token.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => copyTokenUrl(token)}
                            title="URLをコピー"
                          >
                            {copiedTokenId === token.id ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            無効
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {token.useCount} / {token.maxUses}
                    </TableCell>
                    <TableCell>
                      {token.defaultViews && token.defaultViews.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {token.defaultViews.map((dv) => (
                            <Badge
                              key={dv.displayView.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {dv.displayView.viewName}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          未設定
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(token.expiresAt).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>{token.issuer.name}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {token.note ? (
                        <span className="text-sm truncate block" title={token.note}>
                          {token.note}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(token.createdAt).toLocaleString("ja-JP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* トークン発行ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {newToken ? "トークンが発行されました" : "登録トークンを発行"}
            </DialogTitle>
            <DialogDescription>
              {newToken
                ? "以下のURLを外部ユーザーに共有してください"
                : "外部ユーザー登録用のトークンを発行します"}
            </DialogDescription>
          </DialogHeader>

          {newToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>登録URL</Label>
                <div className="flex gap-2">
                  <Input value={newToken.registerUrl} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(newToken.registerUrl)}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertDescription>
                  このURLは一覧画面からも確認・コピーできます。
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 企業選択 */}
              <div className="space-y-2">
                <Label>
                  企業 <span className="text-red-500">*</span>
                </Label>
                <CompanySearchCombobox
                  value={formData.companyId}
                  onChange={handleCompanyChange}
                  placeholder="企業名で検索..."
                />
              </div>

              {/* 管理名 */}
              <div className="space-y-2">
                <Label htmlFor="name">管理名</Label>
                <Input
                  id="name"
                  placeholder="例: 田中様向け、営業部用など"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  誰向けのURLか管理用に記載できます
                </p>
              </div>

              {/* 備考 */}
              <div className="space-y-2">
                <Label htmlFor="note">備考</Label>
                <Input
                  id="note"
                  placeholder="メモなど"
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                />
              </div>

              {/* 最大使用回数 */}
              <div className="space-y-2">
                <Label htmlFor="maxUses">最大使用回数</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="1"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                />
              </div>

              {/* 有効期限 */}
              <div className="space-y-2">
                <Label htmlFor="expiresInDays">有効期限（日数）</Label>
                <Input
                  id="expiresInDays"
                  type="number"
                  min="1"
                  value={formData.expiresInDays}
                  onChange={(e) =>
                    setFormData({ ...formData, expiresInDays: e.target.value })
                  }
                />
              </div>

              <Separator />

              {/* デフォルト権限 */}
              <div className="space-y-3">
                <div>
                  <Label>デフォルト権限（任意）</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    未選択の場合、承認時に設定します
                  </p>
                </div>

                {/* プロジェクト選択 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">プロジェクト</Label>
                  <div className="space-y-2 pl-2">
                    {projects.map((project) => (
                      <div
                        key={project.code}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`project-${project.code}`}
                          checked={formData.selectedProjects.includes(
                            project.code
                          )}
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
                {formData.selectedProjects.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">表示区分</Label>
                    {projects
                      .filter((p) =>
                        formData.selectedProjects.includes(p.code)
                      )
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
                                  checked={formData.selectedViewIds.includes(
                                    view.id
                                  )}
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {newToken ? "閉じる" : "キャンセル"}
            </Button>
            {!newToken && (
              <Button
                onClick={handleCreateToken}
                disabled={processing || !formData.companyId}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    発行中...
                  </>
                ) : (
                  "発行する"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
