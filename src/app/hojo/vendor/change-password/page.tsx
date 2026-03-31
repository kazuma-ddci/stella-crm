"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { changeVendorPassword } from "../[token]/actions";

export default function VendorChangePasswordPage() {
  const { data: session } = useSession();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const vendorAccountId = (session?.user as any)?.vendorAccountId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) { setError("パスワードが一致しません"); return; }
    if (newPassword.length < 8) { setError("パスワードは8文字以上にしてください"); return; }

    setLoading(true);
    try {
      await changeVendorPassword(vendorAccountId, newPassword);
      await signOut({ callbackUrl: "/hojo/vendor" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "パスワード変更に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">パスワード変更</CardTitle>
          <CardDescription className="text-center">初回ログインのため、パスワードの変更が必要です。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">新しいパスワード（8文字以上）</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "変更中..." : "パスワードを変更"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
