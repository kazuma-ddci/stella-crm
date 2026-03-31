"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { approveVendorAccount, suspendVendorAccount, reactivateVendorAccount, resetVendorPassword, deleteVendorAccount } from "./actions";
import { Copy, Check, KeyRound, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type VendorAccountData = {
  id: number;
  vendorId: number;
  vendorName: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  passwordResetRequestedAt: string | null;
  approvedAt: string | null;
  approverName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type VendorInfo = { id: number; name: string; accessToken: string };
type Props = { data: VendorAccountData[]; vendorList: VendorInfo[]; staffId: number };

export function VendorTab({ data, vendorList, staffId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);
  const [resetDialogId, setResetDialogId] = useState<number | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<number | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [expandedVendors, setExpandedVendors] = useState<Set<number>>(new Set(vendorList.map((v) => v.id)));
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const toggleVendor = (vendorId: number) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/hojo/vendor/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("URLをコピーしました");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleAction = async (id: number, action: () => Promise<void>) => {
    setLoading(id);
    try { await action(); router.refresh(); } finally { setLoading(null); }
  };

  const handleResetPassword = async (id: number) => {
    setResetDialogId(null);
    setLoading(id);
    try {
      const password = await resetVendorPassword(id);
      setGeneratedPassword(password);
      setPasswordDialogOpen(true);
      router.refresh();
    } finally { setLoading(null); }
  };

  const handleDelete = async (id: number) => {
    setDeleteDialogId(null);
    await handleAction(id, () => deleteVendorAccount(id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">認証待ち</Badge>;
      case "active": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">有効</Badge>;
      case "suspended": return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">停止</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="space-y-4">
        {vendorList.length === 0 ? (
          <p className="text-center text-gray-500 py-8">登録されたベンダーはありません</p>
        ) : vendorList.map((vendor) => {
          const accounts = data.filter((a) => a.vendorId === vendor.id);
          const pendingCount = accounts.filter((a) => a.status === "pending_approval").length;
          const isExpanded = expandedVendors.has(vendor.id);

          return (
            <Card key={vendor.id}>
              <CardHeader className="cursor-pointer py-3" onClick={() => toggleVendor(vendor.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-base">{vendor.name}</CardTitle>
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">{pendingCount}</Badge>
                    )}
                    <span className="text-sm text-gray-500">({accounts.length}アカウント)</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={(e) => { e.stopPropagation(); copyUrl(vendor.accessToken); }}
                  >
                    {copiedToken === vendor.accessToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedToken === vendor.accessToken ? "コピー済み" : "専用URL"}
                  </Button>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">アカウントが登録されていません</p>
                  ) : (
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>氏名</TableHead>
                            <TableHead>メールアドレス</TableHead>
                            <TableHead>ステータス</TableHead>
                            <TableHead>PW要求</TableHead>
                            <TableHead>最終ログイン</TableHead>
                            <TableHead>操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accounts.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell className="font-medium">{account.name}</TableCell>
                              <TableCell>{account.email}</TableCell>
                              <TableCell>{getStatusBadge(account.status)}</TableCell>
                              <TableCell>
                                {account.passwordResetRequestedAt ? (() => {
                                  const isRecent = Date.now() - new Date(account.passwordResetRequestedAt!).getTime() < 24 * 60 * 60 * 1000;
                                  return (
                                    <div className={`flex items-center gap-1 ${isRecent ? "bg-red-100 text-red-800 px-2 py-0.5 rounded" : ""}`}>
                                      <KeyRound className={`h-4 w-4 ${isRecent ? "text-red-600" : "text-orange-500"}`} />
                                      <span className={`text-xs font-medium ${isRecent ? "text-red-800" : "text-orange-600"}`}>
                                        {new Date(account.passwordResetRequestedAt!).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                  );
                                })() : "-"}
                              </TableCell>
                              <TableCell>{account.lastLoginAt ?? "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  {account.status === "pending_approval" && <Button size="sm" onClick={() => handleAction(account.id, () => approveVendorAccount(account.id, staffId))} disabled={loading === account.id}>認証</Button>}
                                  {account.status === "active" && <Button size="sm" variant="outline" onClick={() => handleAction(account.id, () => suspendVendorAccount(account.id))} disabled={loading === account.id}>停止</Button>}
                                  {account.status === "suspended" && <Button size="sm" variant="outline" onClick={() => handleAction(account.id, () => reactivateVendorAccount(account.id))} disabled={loading === account.id}>有効化</Button>}
                                  <Button size="sm" variant="outline" onClick={() => setResetDialogId(account.id)} disabled={loading === account.id}>PW初期化</Button>
                                  <Button size="sm" variant="destructive" onClick={() => setDeleteDialogId(account.id)} disabled={loading === account.id}>削除</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <AlertDialog open={resetDialogId !== null} onOpenChange={() => setResetDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>パスワードを初期化しますか？</AlertDialogTitle><AlertDialogDescription>ランダムな初期パスワードが生成されます。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => resetDialogId && handleResetPassword(resetDialogId)}>初期化する</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogId !== null} onOpenChange={() => setDeleteDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />アカウントを削除しますか？</AlertDialogTitle><AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={() => deleteDialogId && handleDelete(deleteDialogId)} className="bg-red-600 hover:bg-red-700">削除する</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>初期パスワード</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>以下の初期パスワードをベンダースタッフにお伝えください。</p>
                <div className="bg-gray-100 rounded-lg p-4 text-center"><code className="text-2xl font-mono font-bold tracking-wider text-gray-900">{generatedPassword}</code></div>
                <p className="text-sm text-orange-600">※ このパスワードは一度だけ表示されます。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction onClick={() => { setGeneratedPassword(null); setPasswordDialogOpen(false); }}>確認しました</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
