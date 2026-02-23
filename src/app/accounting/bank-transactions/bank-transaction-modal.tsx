"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import type { BankTransactionRow, BankTransactionFormData } from "./actions";
import { createBankTransaction, updateBankTransaction } from "./actions";

type AttachmentInput = {
  id?: number;
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  attachmentType: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: BankTransactionFormData;
  editEntry?: BankTransactionRow | null;
  onSuccess?: () => void;
};

// 仮想通貨の固定選択肢
const CRYPTO_CURRENCIES = ["USDT", "BTC", "ETH", "USDC"];
const CRYPTO_NETWORKS = ["TRC20", "ERC20", "BEP20"];
const FOREIGN_CURRENCIES = ["USD", "EUR", "JPY"];

export function BankTransactionModal({
  open,
  onOpenChange,
  formData,
  editEntry,
  onSuccess,
}: Props) {
  const isEdit = !!editEntry;

  // フォーム状態
  const [transactionDate, setTransactionDate] = useState(
    editEntry
      ? new Date(editEntry.transactionDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [direction, setDirection] = useState(editEntry?.direction ?? "outgoing");
  const [paymentMethodId, setPaymentMethodId] = useState(
    editEntry?.paymentMethod.id ? String(editEntry.paymentMethod.id) : ""
  );
  const [counterpartyId, setCounterpartyId] = useState(
    editEntry?.counterparty?.id ? String(editEntry.counterparty.id) : ""
  );
  const [amount, setAmount] = useState(
    editEntry?.amount !== undefined ? String(editEntry.amount) : ""
  );
  const [description, setDescription] = useState(editEntry?.description ?? "");

  // 仮想通貨詳細
  const [cryptoCurrency, setCryptoCurrency] = useState(
    editEntry?.cryptoDetail?.currency ?? ""
  );
  const [cryptoNetwork, setCryptoNetwork] = useState(
    editEntry?.cryptoDetail?.network ?? ""
  );
  const [counterpartyWallet, setCounterpartyWallet] = useState(
    editEntry?.cryptoDetail?.counterpartyWallet ?? ""
  );
  const [ownWallet, setOwnWallet] = useState(
    editEntry?.cryptoDetail?.ownWallet ?? ""
  );
  const [foreignAmount, setForeignAmount] = useState(
    editEntry?.cryptoDetail?.foreignAmount
      ? String(editEntry.cryptoDetail.foreignAmount)
      : ""
  );
  const [foreignCurrency, setForeignCurrency] = useState(
    editEntry?.cryptoDetail?.foreignCurrency ?? "USD"
  );
  const [exchangeRate, setExchangeRate] = useState(
    editEntry?.cryptoDetail?.exchangeRate
      ? String(editEntry.cryptoDetail.exchangeRate)
      : ""
  );

  // 証憑
  const [attachments, setAttachments] = useState<AttachmentInput[]>(
    editEntry?.attachments?.map((att) => ({
      id: att.id,
      filePath: att.filePath,
      fileName: att.fileName,
      fileSize: att.fileSize ?? undefined,
      mimeType: att.mimeType ?? undefined,
      attachmentType: att.attachmentType,
    })) ?? []
  );
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 選択中の決済手段
  const selectedPaymentMethod = useMemo(() => {
    if (!paymentMethodId) return null;
    return formData.paymentMethods.find((pm) => pm.id === Number(paymentMethodId));
  }, [paymentMethodId, formData.paymentMethods]);

  const isCrypto = selectedPaymentMethod?.methodType === "crypto_wallet";

  // 取引先オプション
  const counterpartyOptions = useMemo(
    () =>
      formData.counterparties.map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    [formData.counterparties]
  );

  // 日本円金額の自動計算
  const calculatedJpyAmount = useMemo(() => {
    const fa = Number(foreignAmount);
    const er = Number(exchangeRate);
    if (!isNaN(fa) && !isNaN(er) && fa > 0 && er > 0) {
      return Math.round(fa * er);
    }
    return null;
  }, [foreignAmount, exchangeRate]);

  // 外貨金額・レートから円金額を自動設定
  const handleForeignAmountChange = useCallback(
    (value: string) => {
      setForeignAmount(value);
      const fa = Number(value);
      const er = Number(exchangeRate);
      if (!isNaN(fa) && !isNaN(er) && fa > 0 && er > 0) {
        setAmount(String(Math.round(fa * er)));
      }
    },
    [exchangeRate]
  );

  const handleExchangeRateChange = useCallback(
    (value: string) => {
      setExchangeRate(value);
      const fa = Number(foreignAmount);
      const er = Number(value);
      if (!isNaN(fa) && !isNaN(er) && fa > 0 && er > 0) {
        setAmount(String(Math.round(fa * er)));
      }
    },
    [foreignAmount]
  );

  // 証憑アップロード
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      for (let i = 0; i < files.length; i++) {
        formDataUpload.append("files", files[i]);
      }

      const response = await fetch("/api/bank-transactions/upload", {
        method: "POST",
        body: formDataUpload,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "アップロードに失敗しました");
      }

      const newAttachments: AttachmentInput[] = result.files.map(
        (f: { filePath: string; fileName: string; fileSize: number; mimeType: string }) => ({
          filePath: f.filePath,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          attachmentType: "other",
        })
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // 保存
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {
        transactionDate,
        direction,
        paymentMethodId: Number(paymentMethodId),
        counterpartyId: counterpartyId ? Number(counterpartyId) : null,
        amount: Number(amount),
        description: description || null,
        attachments,
      };

      // 仮想通貨詳細
      if (isCrypto && cryptoCurrency) {
        data.cryptoDetail = {
          currency: cryptoCurrency,
          network: cryptoNetwork,
          counterpartyWallet: counterpartyWallet || undefined,
          ownWallet: ownWallet || undefined,
          foreignAmount,
          foreignCurrency,
          exchangeRate,
        };
      }

      if (isEdit && editEntry) {
        await updateBankTransaction(editEntry.id, data);
        toast.success("入出金を更新しました");
      } else {
        await createBankTransaction(data);
        toast.success("入出金を登録しました");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTransactionDate(new Date().toISOString().split("T")[0]);
    setDirection("outgoing");
    setPaymentMethodId("");
    setCounterpartyId("");
    setAmount("");
    setDescription("");
    setCryptoCurrency("");
    setCryptoNetwork("");
    setCounterpartyWallet("");
    setOwnWallet("");
    setForeignAmount("");
    setForeignCurrency("USD");
    setExchangeRate("");
    setAttachments([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isEdit) {
          resetForm();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "入出金編集" : "入出金登録"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            {/* 日付 */}
            <div className="space-y-2">
              <Label>日付 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            </div>

            {/* 区分 */}
            <div className="space-y-2">
              <Label>区分 <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={direction}
                onValueChange={setDirection}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="incoming" id="dir-incoming" />
                  <Label htmlFor="dir-incoming">入金</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="outgoing" id="dir-outgoing" />
                  <Label htmlFor="dir-outgoing">出金</Label>
                </div>
              </RadioGroup>
            </div>

            {/* 決済手段 */}
            <div className="space-y-2">
              <Label>決済手段 <span className="text-red-500">*</span></Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="決済手段を選択" />
                </SelectTrigger>
                <SelectContent>
                  {formData.paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={String(pm.id)}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 取引先 */}
            <div className="space-y-2">
              <Label>取引先</Label>
              <Combobox
                options={counterpartyOptions}
                value={counterpartyId}
                onChange={setCounterpartyId}
                placeholder="取引先を検索..."
              />
            </div>

            {/* 金額 */}
            <div className="space-y-2">
              <Label>金額 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* 摘要 */}
            <div className="space-y-2">
              <Label>摘要</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="摘要を入力"
                rows={2}
              />
            </div>
          </div>

          {/* 仮想通貨詳細（決済手段が仮想通貨の場合のみ表示） */}
          {isCrypto && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h3 className="text-sm font-semibold">仮想通貨取引詳細</h3>

              <div className="grid grid-cols-2 gap-4">
                {/* 銘柄 */}
                <div className="space-y-2">
                  <Label>銘柄 <span className="text-red-500">*</span></Label>
                  <Select value={cryptoCurrency} onValueChange={setCryptoCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="銘柄を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRYPTO_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ネットワーク */}
                <div className="space-y-2">
                  <Label>ネットワーク <span className="text-red-500">*</span></Label>
                  <Select value={cryptoNetwork} onValueChange={setCryptoNetwork}>
                    <SelectTrigger>
                      <SelectValue placeholder="ネットワークを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRYPTO_NETWORKS.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Walletアドレス */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>取引先Walletアドレス</Label>
                  <Input
                    value={counterpartyWallet}
                    onChange={(e) => setCounterpartyWallet(e.target.value)}
                    placeholder="取引先のWalletアドレス"
                  />
                </div>
                <div className="space-y-2">
                  <Label>自社Walletアドレス</Label>
                  <Input
                    value={ownWallet}
                    onChange={(e) => setOwnWallet(e.target.value)}
                    placeholder="自社のWalletアドレス"
                  />
                </div>
              </div>

              {/* 外貨情報 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>外貨金額 <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={foreignAmount}
                    onChange={(e) => handleForeignAmountChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>外貨単位 <span className="text-red-500">*</span></Label>
                  <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOREIGN_CURRENCIES.map((fc) => (
                        <SelectItem key={fc} value={fc}>
                          {fc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>レート <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => handleExchangeRateChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* 自動計算された日本円金額 */}
              {calculatedJpyAmount !== null && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="text-sm font-medium">日本円金額（自動計算）</span>
                  <span className="text-lg font-bold">
                    ¥{calculatedJpyAmount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 証憑 */}
          <div className="space-y-2">
            <Label>証憑</Label>
            <div className="space-y-2">
              {attachments.map((att, index) => (
                <div
                  key={att.filePath}
                  className="flex items-center gap-2 p-2 border rounded-md bg-gray-50"
                >
                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="flex-1 text-sm truncate">{att.fileName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAttachment(index)}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}

              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">アップロード中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      クリックまたはドラッグ&ドロップでファイルを追加
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : isEdit ? (
              "更新"
            ) : (
              "登録"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
