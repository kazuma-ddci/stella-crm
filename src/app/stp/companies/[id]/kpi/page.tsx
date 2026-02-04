"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { KpiTable } from "@/components/kpi-sheet";
import { KpiWeeklyData } from "@/components/kpi-sheet/types";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  Edit2,
  ExternalLink,
} from "lucide-react";
import {
  getKpiSheets,
  createKpiSheet,
  deleteKpiSheet,
  updateKpiSheetName,
  addWeeklyData,
  deleteWeeklyData,
  updateKpiCell,
  updateWeekStartDate,
  createShareLink,
  deleteShareLink,
} from "./actions";

interface KpiSheet {
  id: number;
  stpCompanyId: number;
  name: string;
  weeklyData: KpiWeeklyData[];
  shareLinks: {
    id: number;
    token: string;
    expiresAt: string;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export default function KpiSheetPage() {
  const params = useParams();
  const router = useRouter();
  const stpCompanyId = Number(params.id);

  const [sheets, setSheets] = useState<KpiSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareExpiresHours, setShareExpiresHours] = useState("1");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // データ取得
  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKpiSheets(stpCompanyId);
      setSheets(data);
      if (data.length > 0 && !selectedSheetId) {
        setSelectedSheetId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch KPI sheets:", error);
    } finally {
      setLoading(false);
    }
  }, [stpCompanyId, selectedSheetId]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // 選択中のシート
  const selectedSheet = sheets.find((s) => s.id === selectedSheetId);

  // シート作成
  const handleCreateSheet = useCallback(async () => {
    if (!newSheetName.trim()) return;

    setCreating(true);
    try {
      const result = await createKpiSheet(stpCompanyId, newSheetName.trim());
      setNewSheetName("");
      setCreateDialogOpen(false);
      setSelectedSheetId(result.id);
      await fetchSheets();
    } catch (error) {
      console.error("Failed to create sheet:", error);
    } finally {
      setCreating(false);
    }
  }, [newSheetName, stpCompanyId, fetchSheets]);

  // シート削除
  const handleDeleteSheet = useCallback(
    async (sheetId: number) => {
      try {
        await deleteKpiSheet(sheetId);
        if (selectedSheetId === sheetId) {
          setSelectedSheetId(null);
        }
        await fetchSheets();
      } catch (error) {
        console.error("Failed to delete sheet:", error);
      }
    },
    [selectedSheetId, fetchSheets]
  );

  // シート名更新
  const handleUpdateName = useCallback(
    async (sheetId: number) => {
      if (!editNameValue.trim()) {
        setEditingName(null);
        return;
      }

      try {
        await updateKpiSheetName(sheetId, editNameValue.trim());
        setEditingName(null);
        await fetchSheets();
      } catch (error) {
        console.error("Failed to update name:", error);
      }
    },
    [editNameValue, fetchSheets]
  );

  // 週追加
  const handleAddWeek = useCallback(
    async (startDate: string, endDate: string) => {
      if (!selectedSheetId) return;

      try {
        await addWeeklyData(selectedSheetId, startDate, endDate);
        await fetchSheets();
      } catch (error) {
        console.error("Failed to add week:", error);
      }
    },
    [selectedSheetId, fetchSheets]
  );

  // 週削除
  const handleDeleteWeek = useCallback(
    async (weeklyDataId: number) => {
      try {
        await deleteWeeklyData(weeklyDataId);
        await fetchSheets();
      } catch (error) {
        console.error("Failed to delete week:", error);
      }
    },
    [fetchSheets]
  );

  // セル更新（楽観的更新）
  const handleCellUpdate = useCallback(
    async (weeklyDataId: number, field: string, value: number | null) => {
      // 楽観的更新: 即座にローカルステートを更新
      setSheets((prev) =>
        prev.map((sheet) => ({
          ...sheet,
          weeklyData: sheet.weeklyData.map((week) =>
            week.id === weeklyDataId ? { ...week, [field]: value } : week
          ),
        }))
      );

      // サーバーに保存（エラー時のみ再取得）
      try {
        await updateKpiCell(weeklyDataId, field, value);
      } catch (error) {
        console.error("Failed to update cell:", error);
        await fetchSheets(); // エラー時はリフェッチして整合性を回復
      }
    },
    [fetchSheets]
  );

  // 開始日更新
  const handleUpdateStartDate = useCallback(
    async (weeklyDataId: number, startDate: string) => {
      try {
        await updateWeekStartDate(weeklyDataId, startDate);
        await fetchSheets();
      } catch (error) {
        console.error("Failed to update start date:", error);
      }
    },
    [fetchSheets]
  );

  // 共有リンク生成
  const handleCreateShareLink = useCallback(async () => {
    if (!selectedSheetId) return;

    setGeneratingLink(true);
    try {
      await createShareLink(selectedSheetId, Number(shareExpiresHours));
      setShareDialogOpen(false);
      await fetchSheets();
    } catch (error) {
      console.error("Failed to create share link:", error);
    } finally {
      setGeneratingLink(false);
    }
  }, [selectedSheetId, shareExpiresHours, fetchSheets]);

  // 共有リンク削除
  const handleDeleteShareLink = useCallback(
    async (linkId: number) => {
      try {
        await deleteShareLink(linkId);
        await fetchSheets();
      } catch (error) {
        console.error("Failed to delete share link:", error);
      }
    },
    [fetchSheets]
  );

  // URLコピー
  const copyShareUrl = useCallback((token: string) => {
    const url = `${window.location.origin}/s/kpi/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }, []);

  // 有効期限のフォーマット
  const formatExpiry = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return "期限切れ";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}日後に期限切れ`;
    }

    return hours > 0 ? `${hours}時間${minutes}分後に期限切れ` : `${minutes}分後に期限切れ`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/stp/companies">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              戻る
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">運用KPIシート</h1>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              シートを作成
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいKPIシートを作成</DialogTitle>
              <DialogDescription>
                シート名を入力してください（例: Indeed、Wantedly）
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="シート名"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateSheet();
                }
              }}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleCreateSheet} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                作成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sheets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>KPIシートがありません</p>
            <p className="text-sm mt-2">
              「シートを作成」ボタンをクリックして開始してください
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* シート一覧（サイドバー） */}
          <div className="lg:w-52 shrink-0 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              シート一覧
            </h2>
            {sheets.map((sheet) => (
              <Card
                key={sheet.id}
                className={`cursor-pointer transition-colors ${
                  selectedSheetId === sheet.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setSelectedSheetId(sheet.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    {editingName === String(sheet.id) ? (
                      <Input
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onBlur={() => handleUpdateName(sheet.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateName(sheet.id);
                          } else if (e.key === "Escape") {
                            setEditingName(null);
                          }
                        }}
                        className="h-7 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium text-sm">{sheet.name}</span>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingName(String(sheet.id));
                          setEditNameValue(sheet.name);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              シートを削除
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              「{sheet.name}」を削除しますか？
                              週次データも全て削除されます。この操作は取り消せません。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSheet(sheet.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              削除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sheet.weeklyData.length}週のデータ
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1 min-w-0 space-y-4">
            {selectedSheet && (
              <>
                {/* シートヘッダー＆共有リンク */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <CardTitle className="text-lg">{selectedSheet.name}</CardTitle>
                      <Dialog
                        open={shareDialogOpen}
                        onOpenChange={setShareDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="shrink-0">
                            <LinkIcon className="h-4 w-4 mr-2" />
                            共有リンクを発行
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>共有リンクを発行</DialogTitle>
                            <DialogDescription>
                              有効期限を選択してください。期限が過ぎるとリンクは無効になります。
                            </DialogDescription>
                          </DialogHeader>
                          <Select
                            value={shareExpiresHours}
                            onValueChange={setShareExpiresHours}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1時間</SelectItem>
                              <SelectItem value="6">6時間</SelectItem>
                              <SelectItem value="24">24時間</SelectItem>
                              <SelectItem value="168">7日間</SelectItem>
                            </SelectContent>
                          </Select>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShareDialogOpen(false)}
                            >
                              キャンセル
                            </Button>
                            <Button
                              onClick={handleCreateShareLink}
                              disabled={generatingLink}
                            >
                              {generatingLink && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              発行
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* 有効な共有リンク一覧 */}
                    {selectedSheet.shareLinks.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">有効な共有リンク</p>
                        <div className="space-y-2">
                          {selectedSheet.shareLinks.map((link) => (
                            <div
                              key={link.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/30 border rounded-md px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {formatExpiry(link.expiresAt)}
                                </Badge>
                                <code className="text-xs text-muted-foreground truncate">
                                  /s/kpi/{link.token.slice(0, 12)}...
                                </code>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => copyShareUrl(link.token)}
                                >
                                  {copiedToken === link.token ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Link
                                  href={`/s/kpi/${link.token}`}
                                  target="_blank"
                                >
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteShareLink(link.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                </Card>

                {/* KPIテーブル */}
                <Card>
                  <CardContent className="p-4 overflow-x-auto">
                    <KpiTable
                      weeklyData={selectedSheet.weeklyData}
                      editable={true}
                      onCellUpdate={handleCellUpdate}
                      onAddWeek={handleAddWeek}
                      onDeleteWeek={handleDeleteWeek}
                      onUpdateStartDate={handleUpdateStartDate}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
