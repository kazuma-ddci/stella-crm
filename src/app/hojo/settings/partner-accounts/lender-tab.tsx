"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { approveLenderAccount, suspendLenderAccount, reactivateLenderAccount, resetLenderPassword, deleteLenderAccount } from "./actions";
import { KeyRound, AlertTriangle } from "lucide-react";

type LenderAccountData = {
  id: number;
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

type Props = { data: LenderAccountData[]; staffId: number };

export function LenderTab({ data, staffId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);
  const [resetDialogId, setResetDialogId] = useState<number | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<number | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const handleAction = async (id: number, action: () => Promise<void>) => {
    setLoading(id);
    try { await action(); router.refresh(); } finally { setLoading(null); }
  };

  const handleResetPassword = async (id: number) => {
    setResetDialogId(null);
    setLoading(id);
    try {
      const password = await resetLenderPassword(id);
      setGeneratedPassword(password);
      setPasswordDialogOpen(true);
      router.refresh();
    } finally { setLoading(null); }
  };

  const handleDelete = async (id: number) => {
    setDeleteDialogId(null);
    await handleAction(id, () => deleteLenderAccount(id));
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
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>PW要求</TableHead>
              <TableHead>認証日</TableHead>
              <TableHead>認証者</TableHead>
              <TableHead>最終ログイン</TableHead>
              <TableHead>登録日</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">登録された貸金業社アカウントはありません</TableCell></TableRow>
            ) : data.map((account) => (
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
                <TableCell>{account.approvedAt ?? "-"}</TableCell>
                <TableCell>{account.approverName ?? "-"}</TableCell>
                <TableCell>{account.lastLoginAt ?? "-"}</TableCell>
                <TableCell>{account.createdAt}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {account.status === "pending_approval" && <Button size="sm" onClick={() => handleAction(account.id, () => approveLenderAccount(account.id, staffId))} disabled={loading === account.id}>認証</Button>}
                    {account.status === "active" && <Button size="sm" variant="outline" onClick={() => handleAction(account.id, () => suspendLenderAccount(account.id))} disabled={loading === account.id}>停止</Button>}
                    {account.status === "suspended" && <Button size="sm" variant="outline" onClick={() => handleAction(account.id, () => reactivateLenderAccount(account.id))} disabled={loading === account.id}>有効化</Button>}
                    <Button size="sm" variant="outline" onClick={() => setResetDialogId(account.id)} disabled={loading === account.id}>PW初期化</Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteDialogId(account.id)} disabled={loading === account.id}>削除</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
                <p>以下の初期パスワードを貸金業社スタッフにお伝えください。</p>
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
