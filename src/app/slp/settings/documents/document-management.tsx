"use client";

import { useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileText, Trash2, CheckCircle2, Clock, Link2, Copy, Check, Video, Film } from "lucide-react";
import { activateDocument, deleteDocument, activateVideo, deleteVideo } from "./actions";
import { useRouter } from "next/navigation";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type DocumentItem = {
  id: number;
  fileName: string;
  fileSize: number;
  isActive: boolean;
  note: string | null;
  uploadedByName: string;
  createdAt: string;
};

type VideoItem = DocumentItem;

type AccessLogItem = {
  id: number;
  uid: string;
  snsname: string;
  resourceType: string;
  ipAddress: string | null;
  accessedAt: string;
};

type Props = {
  documents: DocumentItem[];
  videos: VideoItem[];
  accessLogs: AccessLogItem[];
  canEdit: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ViewerUrlCard({
  title,
  description,
  pathName,
}: {
  title: string;
  description: string;
  pathName: string;
}) {
  const [copied, setCopied] = useState(false);
  const viewerUrlTemplate = `${APP_URL}${pathName}?uid=[[uid]]&snsname=[[snsname]]`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(viewerUrlTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description}<code className="bg-muted px-1 rounded text-xs">[[uid]]</code> と <code className="bg-muted px-1 rounded text-xs">[[snsname]]</code> はプロラインの差し込み変数で自動置換されます。両方が揃っていないとアクセスできません。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
            {viewerUrlTemplate}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                コピー済
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                コピー
              </>
            )}
          </Button>
        </div>
        <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p className="font-medium">セキュリティに関する注意</p>
          <p>・URLはそのまま送らず、必ず短縮URL等に変換してから配布してください（uid・snsnameが露出します）</p>
          <p>・閲覧ページではURL欄からパラメータを自動的に削除します</p>
          <p>・閲覧時のuid・snsname・IPアドレス・時刻はアクセスログに記録されます</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AccessLogTable({ accessLogs }: { accessLogs: AccessLogItem[] }) {
  const [filter, setFilter] = useState<"all" | "document" | "video">("all");

  const filteredLogs = accessLogs.filter((log) => {
    if (filter === "all") return true;
    return log.resourceType === filter;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>資料・動画アクセスログ（直近100件）</CardTitle>
        <CardDescription>
          閲覧URLにアクセスがあった記録です。流出元の特定に使用してください。
        </CardDescription>
        <div className="flex gap-2 pt-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            全て ({accessLogs.length})
          </Button>
          <Button
            variant={filter === "document" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("document")}
          >
            <FileText className="h-3 w-3 mr-1" />
            PDF ({accessLogs.filter((l) => l.resourceType === "document").length})
          </Button>
          <Button
            variant={filter === "video" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("video")}
          >
            <Video className="h-3 w-3 mr-1" />
            動画 ({accessLogs.filter((l) => l.resourceType === "video").length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            該当するアクセスログはありません。
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b">
                    <th className="text-left px-3 py-2 font-medium">アクセス日時</th>
                    <th className="text-left px-3 py-2 font-medium">種別</th>
                    <th className="text-left px-3 py-2 font-medium">snsname</th>
                    <th className="text-left px-3 py-2 font-medium">uid</th>
                    <th className="text-left px-3 py-2 font-medium">IPアドレス</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(log.accessedAt)}
                      </td>
                      <td className="px-3 py-2">
                        {log.resourceType === "video" ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <Video className="h-3 w-3 mr-1" />
                            動画
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <FileText className="h-3 w-3 mr-1" />
                            PDF
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{log.snsname}</td>
                      <td className="px-3 py-2 font-mono text-xs break-all">{log.uid}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VideoManagementTab({ videos, canEdit }: { videos: VideoItem[]; canEdit: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      alert("対応していない動画形式です（mp4 / webm / mov のみ）");
      return;
    }

    if (file.size > 1024 * 1024 * 1024) {
      alert("ファイルサイズは1GB以下にしてください");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (note.trim()) formData.append("note", note.trim());

      const res = await fetch("/api/slp/videos/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "アップロードに失敗しました");
        return;
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
      setNote("");
      router.refresh();
    } catch {
      alert("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActionLoading(id);
    try {
      await activateVideo(id);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    setActionLoading(id);
    try {
      await deleteVideo(id);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const activeVideo = videos.find((v) => v.isActive);

  return (
    <div className="space-y-6">
      {/* 現在配布中の動画 */}
      <Card>
        <CardHeader>
          <CardTitle>現在配布中の動画</CardTitle>
          <CardDescription>
            組合員が閲覧できる動画です。新しい動画をアップロードすると自動的に切り替わります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeVideo ? (
            <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
              <Film className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activeVideo.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(activeVideo.fileSize)} ・ {formatDate(activeVideo.createdAt)} ・ {activeVideo.uploadedByName}
                  {activeVideo.note && ` ・ ${activeVideo.note}`}
                </p>
              </div>
              <Badge variant="default" className="bg-green-600 shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                配布中
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
              配布中の動画がありません。動画をアップロードしてください。
            </p>
          )}
        </CardContent>
      </Card>

      {/* 動画閲覧URL */}
      <ViewerUrlCard
        title="動画閲覧URL"
        description="組合員が動画を閲覧するためのURLです。"
        pathName="/form/slp-video"
      />

      {/* アップロード */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>新しい動画をアップロード</CardTitle>
            <CardDescription>
              動画ファイルをアップロードすると、自動的に配布中の動画が切り替わります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="video-file">動画ファイル</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                ref={fileInputRef}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                最大1GB。mp4 / webm / mov 形式に対応。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-video-note">メモ（任意）</Label>
              <Input
                id="upload-video-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 2026年4月版 説明動画"
                disabled={uploading}
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  アップロード
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              ※大容量動画のアップロードには時間がかかります。完了まで画面を閉じないでください。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 動画履歴 */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>動画履歴</CardTitle>
            <CardDescription>
              アップロード済みの動画一覧です。過去の動画に切り替えることもできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {videos.map((v) => (
                <div
                  key={v.id}
                  className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
                    v.isActive ? "border-green-200 bg-green-50" : ""
                  }`}
                >
                  <Film className={`h-5 w-5 shrink-0 ${v.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${v.isActive ? "font-medium" : ""}`}>
                      {v.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(v.fileSize)} ・ {formatDate(v.createdAt)} ・ {v.uploadedByName}
                      {v.note && ` ・ ${v.note}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.isActive ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        配布中
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          停止中
                        </Badge>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === v.id}
                            onClick={() => handleActivate(v.id)}
                          >
                            {actionLoading === v.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "配布に切り替え"
                            )}
                          </Button>
                        )}
                        {canEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={actionLoading === v.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  「{v.fileName}」を削除します。この操作は元に戻せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(v.id)}>
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DocumentManagement({ documents, videos, accessLogs, canEdit }: Props) {
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("PDFファイルのみアップロード可能です");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (note.trim()) formData.append("note", note.trim());

      const res = await fetch("/api/slp/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "アップロードに失敗しました");
        return;
      }

      // リセット
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNote("");
      router.refresh();
    } catch {
      alert("アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (id: number) => {
    setActionLoading(id);
    try {
      await activateDocument(id);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    setActionLoading(id);
    try {
      await deleteDocument(id);
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  };

  const activeDoc = documents.find((d) => d.isActive);

  return (
    <Tabs defaultValue="management">
      <TabsList>
        <TabsTrigger value="management">
          <FileText className="h-4 w-4 mr-1" />
          資料管理（PDF）
        </TabsTrigger>
        <TabsTrigger value="videos">
          <Video className="h-4 w-4 mr-1" />
          動画管理
        </TabsTrigger>
        <TabsTrigger value="logs">アクセスログ</TabsTrigger>
      </TabsList>
      <TabsContent value="management" className="space-y-6">
      {/* 現在配布中の資料 */}
      <Card>
        <CardHeader>
          <CardTitle>現在配布中の資料</CardTitle>
          <CardDescription>
            組合員が閲覧できるPDF資料です。新しい資料をアップロードすると自動的に切り替わります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeDoc ? (
            <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
              <FileText className="h-5 w-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activeDoc.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(activeDoc.fileSize)} ・ {formatDate(activeDoc.createdAt)} ・ {activeDoc.uploadedByName}
                  {activeDoc.note && ` ・ ${activeDoc.note}`}
                </p>
              </div>
              <Badge variant="default" className="bg-green-600 shrink-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                配布中
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-3">
              配布中の資料がありません。PDFをアップロードしてください。
            </p>
          )}
        </CardContent>
      </Card>

      {/* PDF閲覧URL */}
      <ViewerUrlCard
        title="PDF閲覧URL"
        description="組合員がPDFを閲覧するためのURLです。"
        pathName="/form/slp-document"
      />

      {/* アップロード */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>新しい資料をアップロード</CardTitle>
            <CardDescription>
              PDFファイルをアップロードすると、自動的に配布中の資料が切り替わります。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDFファイル</Label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                ref={fileInputRef}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground">
                最大50MB。PDFファイルのみ対応。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upload-note">メモ（任意）</Label>
              <Input
                id="upload-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 2026年4月版"
                disabled={uploading}
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  アップロード
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 過去の資料一覧 */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>資料履歴</CardTitle>
            <CardDescription>
              アップロード済みの資料一覧です。過去の資料に切り替えることもできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
                    doc.isActive ? "border-green-200 bg-green-50" : ""
                  }`}
                >
                  <FileText className={`h-5 w-5 shrink-0 ${doc.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${doc.isActive ? "font-medium" : ""}`}>
                      {doc.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(doc.fileSize)} ・ {formatDate(doc.createdAt)} ・ {doc.uploadedByName}
                      {doc.note && ` ・ ${doc.note}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.isActive ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        配布中
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          停止中
                        </Badge>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={actionLoading === doc.id}
                            onClick={() => handleActivate(doc.id)}
                          >
                            {actionLoading === doc.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "配布に切り替え"
                            )}
                          </Button>
                        )}
                        {canEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={actionLoading === doc.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>資料を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  「{doc.fileName}」を削除します。この操作は元に戻せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(doc.id)}>
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </TabsContent>
      <TabsContent value="videos">
        <VideoManagementTab videos={videos} canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="logs">
        <AccessLogTable accessLogs={accessLogs} />
      </TabsContent>
    </Tabs>
  );
}
