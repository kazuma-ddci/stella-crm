"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Eye, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { createVendorFromFormSubmission } from "./actions";
import { getHojoCustomerOrigin } from "@/lib/hojo/customer-domain";

type FormResponse = {
  id: number;
  companyName: string | null;
  representName: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string;
  answers: Record<string, string>;
  staffMemo: string | null;
};

type Props = {
  data: FormResponse[];
  canEdit: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  companyName: "法人名",
  representativeName: "代表者名",
  representativePhone: "代表者電話番号",
  representativeEmail: "代表者メールアドレス",
  representativeLineName: "代表者LINE名",
  contactName: "主担当者名",
  contactPhone: "主担当者電話番号",
  contactEmail: "主担当者メールアドレス",
  contactLineName: "主担当者LINE名",
  scWholesale: "セキュリティクラウド卸",
  consultingPlan: "コンサルティングプラン",
  grantApplicationBpo: "交付申請BPO",
  subsidyConsulting: "助成金コンサルティング",
  loanUsage: "貸金利用の有無",
  vendorRegistration: "ベンダー登録の有無",
};

export function FormResponsesTable({ data, canEdit }: Props) {
  const router = useRouter();
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formUrl, setFormUrl] = useState("/form/hojo-contract-confirmation");

  useEffect(() => {
    setFormUrl(`${getHojoCustomerOrigin()}/form/hojo-contract-confirmation`);
  }, []);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const handleCreateVendor = async (response: FormResponse) => {
    if (!confirm(`「${response.answers.companyName || "（法人名なし）"}」をベンダーとして登録しますか？\nフォーム回答の内容が基本情報に転記されます。`)) return;
    setCreating(true);
    try {
      const result = await createVendorFromFormSubmission(response.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`ベンダー「${result.data.vendorName}」を作成しました`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const isCreated = (r: FormResponse) => !!r.staffMemo?.startsWith("ベンダー作成済み");

  return (
    <>
      <div className="mb-4 rounded-lg border bg-muted/50 p-3">
        <p className="text-sm font-medium mb-1.5">契約内容確認フォームURL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white rounded px-3 py-2 border break-all">
            {formUrl}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
            {copied ? (
              <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</>
            ) : (
              <><Copy className="h-4 w-4 mr-1" />コピー</>
            )}
          </Button>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">フォーム回答がありません</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              <TableHead>法人名</TableHead>
              <TableHead>代表者名</TableHead>
              <TableHead>SCクラウド卸</TableHead>
              <TableHead>コンサルプラン</TableHead>
              <TableHead>送信日時</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="w-[160px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.id} className="group/row">
                <TableCell className="text-center">{r.id}</TableCell>
                <TableCell className="font-medium">{r.companyName || "-"}</TableCell>
                <TableCell>{r.representName || "-"}</TableCell>
                <TableCell>{r.answers.scWholesale || "-"}</TableCell>
                <TableCell>{r.answers.consultingPlan || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </TableCell>
                <TableCell>
                  {isCreated(r) ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">作成済み</Badge>
                  ) : (
                    <Badge variant="secondary">未作成</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedResponse(r)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      詳細
                    </Button>
                    {canEdit && !isCreated(r) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateVendor(r)}
                        disabled={creating}
                      >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                        作成
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* 詳細ダイアログ */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>フォーム回答詳細</DialogTitle>
          </DialogHeader>
          {selectedResponse && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                送信日時: {new Date(selectedResponse.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </div>
              <div className="divide-y">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const value = selectedResponse.answers[key];
                  if (!value) return null;
                  return (
                    <div key={key} className="py-2 flex justify-between">
                      <span className="text-sm font-medium text-gray-600">{label}</span>
                      <span className="text-sm text-gray-900">{value}</span>
                    </div>
                  );
                })}
              </div>
              {isCreated(selectedResponse) && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-800 whitespace-pre-wrap">{selectedResponse.staffMemo}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedResponse && canEdit && !isCreated(selectedResponse) && (
              <Button
                onClick={() => {
                  setSelectedResponse(null);
                  handleCreateVendor(selectedResponse);
                }}
                disabled={creating}
              >
                <Plus className="h-4 w-4 mr-1" />
                ベンダーとして登録
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
