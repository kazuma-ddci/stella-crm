"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { generateMonthlyAction } from "./generate-monthly-action";

export function GenerateMonthlyButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    revenueCreated: number;
    expenseCreated: number;
  } | null>(null);

  const handleGenerate = async () => {
    if (
      !confirm(
        "当月から2ヶ月先までの売上・経費レコードを一括生成します。\n既存レコードは上書きされません。\n\n実行しますか？"
      )
    )
      return;

    setLoading(true);
    setResult(null);
    try {
      const res = await generateMonthlyAction();
      setResult(res);
      router.refresh();
    } catch {
      alert("一括生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleGenerate} disabled={loading} variant="outline">
        {loading ? "生成中..." : "月次売上・経費を一括生成"}
      </Button>
      {result && (
        <span className="text-sm text-muted-foreground">
          売上 {result.revenueCreated}件、経費 {result.expenseCreated}件 を新規生成しました
        </span>
      )}
    </div>
  );
}
