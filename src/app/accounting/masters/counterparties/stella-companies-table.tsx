"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Check, Building2 } from "lucide-react";
import { toast } from "sonner";
import { updateStellaCompanyInvoiceInfo } from "./actions";

type BankAccount = {
  id: number;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountHolderName: string;
};

type StellaCompanyRow = {
  id: number;
  companyCode: string;
  name: string;
  corporateNumber: string | null;
  isInvoiceRegistered: boolean;
  invoiceRegistrationNumber: string | null;
  invoiceEffectiveDate: Date | null;
  closingDay: number | null;
  paymentMonthOffset: number | null;
  paymentDay: number | null;
  bankAccounts: BankAccount[];
  counterparties: { id: number; displayId: string | null }[];
};

type Props = {
  data: StellaCompanyRow[];
};

function formatDay(day: number | null): string {
  if (day === null || day === undefined) return "-";
  if (day === 0) return "末日";
  return `${day}日`;
}

function formatPaymentTerm(
  closingDay: number | null,
  paymentMonthOffset: number | null,
  paymentDay: number | null
): string {
  if (closingDay === null && paymentMonthOffset === null && paymentDay === null) {
    return "-";
  }
  const closing = formatDay(closingDay);
  const monthLabel =
    paymentMonthOffset === null
      ? ""
      : paymentMonthOffset === 0
        ? "当月"
        : paymentMonthOffset === 1
          ? "翌月"
          : `${paymentMonthOffset}ヶ月後`;
  const payment = formatDay(paymentDay);
  return `${closing}締め ${monthLabel}${payment}払い`;
}

export function StellaCompaniesTable({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState("");
  const [editCompany, setEditCompany] = useState<StellaCompanyRow | null>(null);
  const [editInvoiceRegistered, setEditInvoiceRegistered] = useState(false);
  const [editRegNumber, setEditRegNumber] = useState("");
  const [editInvoiceEffectiveDate, setEditInvoiceEffectiveDate] = useState("");

  const filtered = useMemo(() => {
    if (!searchText.trim()) return data;
    const q = searchText.trim().toLowerCase();
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.companyCode.toLowerCase().includes(q) ||
        c.corporateNumber?.toLowerCase().includes(q) ||
        c.invoiceRegistrationNumber?.toLowerCase().includes(q)
    );
  }, [data, searchText]);

  const openEdit = (company: StellaCompanyRow) => {
    setEditCompany(company);
    setEditInvoiceRegistered(company.isInvoiceRegistered);
    setEditRegNumber(company.invoiceRegistrationNumber ?? "");
    setEditInvoiceEffectiveDate(
      company.invoiceEffectiveDate
        ? new Date(company.invoiceEffectiveDate).toISOString().split("T")[0]
        : ""
    );
  };

  const handleSave = () => {
    if (!editCompany) return;
    startTransition(async () => {
      try {
        await updateStellaCompanyInvoiceInfo(editCompany.id, {
          isInvoiceRegistered: editInvoiceRegistered,
          invoiceRegistrationNumber: editRegNumber || null,
          invoiceEffectiveDate: editInvoiceEffectiveDate || null,
        });
        toast.success("インボイス情報を更新しました");
        setEditCompany(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "更新に失敗しました"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="企業名・コード・登録番号で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-80"
        />
        <span className="text-sm text-muted-foreground">
          {filtered.length}件
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          顧客マスタデータがありません
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>企業名</TableHead>
                <TableHead>法人番号</TableHead>
                <TableHead>インボイス</TableHead>
                <TableHead>登録番号</TableHead>
                <TableHead>支払条件</TableHead>
                <TableHead>銀行口座</TableHead>
                <TableHead className="w-[60px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((company) => (
                <TableRow key={company.id} className="group/row">
                  <TableCell className="font-mono text-xs">
                    {company.companyCode}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {company.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {company.corporateNumber ?? "-"}
                  </TableCell>
                  <TableCell>
                    {company.isInvoiceRegistered ? (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          有
                        </Badge>
                        {company.invoiceEffectiveDate && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(company.invoiceEffectiveDate).toLocaleDateString("ja-JP")}〜
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">無</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {company.isInvoiceRegistered
                      ? (company.invoiceRegistrationNumber ?? "-")
                      : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatPaymentTerm(
                      company.closingDay,
                      company.paymentMonthOffset,
                      company.paymentDay
                    )}
                  </TableCell>
                  <TableCell>
                    {company.bankAccounts.length > 0 ? (
                      <div className="space-y-1">
                        {company.bankAccounts.map((ba) => (
                          <div key={ba.id} className="text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {ba.bankName} {ba.branchName} {ba.accountNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(company)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* インボイス情報編集モーダル */}
      <Dialog
        open={!!editCompany}
        onOpenChange={(open) => {
          if (!open) setEditCompany(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              インボイス情報編集 - {editCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="editInvoiceRegistered"
                checked={editInvoiceRegistered}
                onCheckedChange={(checked) => {
                  setEditInvoiceRegistered(checked === true);
                  if (!checked) setEditRegNumber("");
                }}
              />
              <Label htmlFor="editInvoiceRegistered" className="cursor-pointer">
                インボイス登録有り
              </Label>
            </div>
            {editInvoiceRegistered && (
              <>
                <div>
                  <Label>登録番号</Label>
                  <Input
                    value={editRegNumber}
                    onChange={(e) => setEditRegNumber(e.target.value)}
                    placeholder="T1234567890123"
                    className="mt-1 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    T + 13桁の数字で入力してください
                  </p>
                </div>
                <div>
                  <Label>インボイス適用日</Label>
                  <Input
                    type="date"
                    value={editInvoiceEffectiveDate}
                    onChange={(e) => setEditInvoiceEffectiveDate(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    この日以降の仕訳で税区分チェックが有効になります
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCompany(null)}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
