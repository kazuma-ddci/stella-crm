"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Link as LinkIcon } from "lucide-react";

/**
 * 貸金業社様 専用ページの共有用URLを表示するカード
 * スタッフ側の「借入申込フォーム回答」「顧客進捗状況」ページで使用
 */
export function LenderShareableUrlCard() {
  const [copied, setCopied] = useState(false);
  // NEXT_PUBLIC_LENDER_DOMAIN が設定されていればそれを使用、なければクライアント側で window.origin にフォールバック。
  // 本番: https://loan.alkes.jp, stg: https://stg-loan.alkes.jp, ローカル: http://localhost:3000
  // SSR時とクライアント初回レンダーで値が変わるとhydration mismatchになるため、初期値はenv（または相対パス）に固定し、
  // クライアント側で必要時のみ window.origin に書き換える。
  const envDomain = process.env.NEXT_PUBLIC_LENDER_DOMAIN || "";
  const [portalUrl, setPortalUrl] = useState(`${envDomain}/hojo/lender`);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_LENDER_DOMAIN) {
      setPortalUrl(`${window.location.origin}/hojo/lender`);
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = portalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          貸金業社様 専用ページ 共有URL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          このURLを貸金業社のご担当者様にお送りください。ログイン後、こちらのポータルにアクセスできます。
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-gray-100 rounded px-3 py-2 break-all">{portalUrl}</code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? (
              <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</>
            ) : (
              <><Copy className="h-4 w-4 mr-1" />コピー</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
