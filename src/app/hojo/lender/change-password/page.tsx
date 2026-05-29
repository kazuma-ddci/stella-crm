"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { changeLenderPassword } from "../actions";
import { useSession } from "next-auth/react";

export default function LenderChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const lenderAccountId = session?.user?.lenderAccountId;
  const isLenderAccount = session?.user?.userType === "lender" && !!lenderAccountId;
  const isForcedChange = session?.user?.mustChangePassword === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    if (newPassword.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);
    try {
      if (!lenderAccountId) {
        setError("セッションが無効です");
        return;
      }
      const result = await changeLenderPassword(lenderAccountId, newPassword);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await update();
      router.replace("/hojo/lender");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">確認中</CardTitle>
            <CardDescription className="text-center">
              ログイン状態を確認しています。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isLenderAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl">ログインが必要です</CardTitle>
            <CardDescription className="text-center">
              パスワード変更は、対象の貸金業者アカウントでログインした後に利用できます。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">パスワード変更</CardTitle>
          <CardDescription className="text-center">
            {isForcedChange
              ? "パスワードを初期化されたアカウントでログインされています。続行するにはパスワードを変更してください。"
              : "新しいパスワードを設定してください。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">新しいパスワード（8文字以上）</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "変更中..." : "パスワードを変更"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
