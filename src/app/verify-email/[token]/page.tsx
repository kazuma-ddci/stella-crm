"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function verifyEmail() {
      try {
        const response = await fetch(`/api/verify-email/${token}`, {
          method: "POST",
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(data.error || "メール認証に失敗しました");
          return;
        }

        setStatus("success");
        setMessage(data.message || "メール認証が完了しました");
      } catch {
        setStatus("error");
        setMessage("メール認証中にエラーが発生しました");
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {status === "loading" && (
            <>
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                <CardTitle>メール認証中...</CardTitle>
              </div>
              <CardDescription>
                メールアドレスの認証を行っています。しばらくお待ちください。
              </CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle>メール認証完了</CardTitle>
              </div>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex items-center gap-2">
                <XCircle className="h-6 w-6 text-red-600" />
                <CardTitle>認証エラー</CardTitle>
              </div>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {status === "success" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                メールアドレスの認証が完了しました。
                管理者の承認後、アカウントが有効になります。
                承認完了時に再度メールでお知らせします。
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                ログインページへ
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                認証リンクが無効または期限切れの可能性があります。
                管理者にお問い合わせください。
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/login")}
              >
                ログインページへ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
