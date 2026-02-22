"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCompany, getCompanyDeleteInfo } from "./actions";
import type { CompanyRelatedData } from "@/types/company-merge";

type Props = {
  id: number;
  name: string;
};

const relatedDataLabels: { key: keyof CompanyRelatedData; label: string }[] = [
  { key: "stpCompanies", label: "STP企業" },
  { key: "stpAgents", label: "代理店" },
  { key: "contracts", label: "契約" },
  { key: "contractHistories", label: "契約履歴" },
  { key: "contactHistories", label: "接触履歴" },
  { key: "locations", label: "拠点" },
  { key: "contacts", label: "担当者" },
  { key: "bankAccounts", label: "銀行口座" },
  { key: "externalUsers", label: "外部ユーザー" },
  { key: "registrationTokens", label: "登録トークン" },
  { key: "referredAgents", label: "紹介先代理店" },
  { key: "leadFormSubmissions", label: "リード回答" },
];

export function DeleteCompanyButton({ id, name }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [relatedData, setRelatedData] = useState<CompanyRelatedData | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setInfoLoading(true);
      getCompanyDeleteInfo(id)
        .then(setRelatedData)
        .catch(() => setRelatedData(null))
        .finally(() => setInfoLoading(false));
    } else {
      setRelatedData(null);
    }
  }, [open, id]);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteCompany(id);
      toast.success("顧客を削除しました");
      router.push("/companies");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const nonZeroItems = relatedData
    ? relatedDataLabels.filter((item) => relatedData[item.key] > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          削除
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>顧客の削除</DialogTitle>
          <DialogDescription>
            「{name}」を削除しますか？
          </DialogDescription>
        </DialogHeader>

        {infoLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">関連データを確認中...</span>
          </div>
        ) : relatedData ? (
          <div className="space-y-2">
            {nonZeroItems.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  この企業には以下の関連データがあります:
                </p>
                <ul className="text-sm space-y-1 pl-4">
                  {nonZeroItems.map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <span className="text-muted-foreground">・</span>
                      <span>{item.label}: <strong>{relatedData[item.key]}件</strong></span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  削除すると、この企業と関連データは全ての画面から非表示になります。データ自体はデータベースに保持されます。
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">関連データはありません。</p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || infoLoading}>
            {loading ? "削除中..." : "削除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
