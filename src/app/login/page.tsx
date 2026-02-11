"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("メールアドレスまたはパスワードが正しくありません");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("ログイン中にエラーが発生しました");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {process.env.NEXT_PUBLIC_APP_TITLE || "Stella 基幹OS"}
          </CardTitle>
          <CardDescription className="text-center">
            ログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {reason === "permissions_changed" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  権限が変更されたため、再ログインが必要です。
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="text"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
              )}
            </Button>
            <div className="text-center text-sm">
              <Link
                href="/forgot-password"
                className="text-gray-600 hover:text-gray-900 hover:underline"
              >
                パスワードをお忘れの方
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
