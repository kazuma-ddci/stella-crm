"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { bulkUpdateInvoiceClassification, type InvoiceMismatchGroup } from "./actions";

type Props = {
  data: InvoiceMismatchGroup[];
};

const TAX_LABEL: Record<string, string> = {
  taxable_10_no_invoice: "課税10%（インボイスなし）",
  taxable_8_no_invoice: "課税8%（インボイスなし・軽減）",
};

export function InvoiceCheckClient({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (journalIds: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = journalIds.every((id) => next.has(id));
      if (allSelected) {
        journalIds.forEach((id) => next.delete(id));
      } else {
        journalIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkUpdate = (groupJournalIds?: number[]) => {
    const idsToUpdate = groupJournalIds
      ? groupJournalIds.filter((id) => selectedIds.has(id))
      : Array.from(selectedIds);

    if (idsToUpdate.length === 0) {
      toast.error("更新する仕訳を選択してください");
      return;
    }

    startTransition(async () => {
      try {
        await bulkUpdateInvoiceClassification(idsToUpdate);
        toast.success(`${idsToUpdate.length}件の仕訳の税区分を更新しました`);
        setSelectedIds(new Set());
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "更新に失敗しました"
        );
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">インボイス税区分チェック</h1>
        <p className="text-sm text-muted-foreground mt-1">
          インボイス登録後に作成された仕訳で、税区分が「インボイスなし」のままのものを表示しています。
        </p>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          対象となる仕訳はありません
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((group) => {
            const journalIds = group.journals.map((j) => j.id);
            const allSelected = journalIds.every((id) => selectedIds.has(id));
            const someSelected = journalIds.some((id) => selectedIds.has(id));
            const selectedCount = journalIds.filter((id) => selectedIds.has(id)).length;

            return (
              <div key={group.counterparty.id} className="border rounded-lg">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {group.counterparty.displayId
                        ? `${group.counterparty.displayId} ${group.counterparty.name}`
                        : group.counterparty.name}
                    </span>
                    <span className="text-sm text-muted-foreground ml-3">
                      インボイス適用日: {new Date(group.counterparty.invoiceEffectiveDate).toLocaleDateString("ja-JP")}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({group.journals.length}件)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleBulkUpdate(journalIds)}
                    disabled={isPending || !someSelected}
                  >
                    {isPending ? "更新中..." : `選択した仕訳の税区分を更新 (${selectedCount}件)`}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleGroup(journalIds)}
                        />
                      </TableHead>
                      <TableHead>仕訳日</TableHead>
                      <TableHead>摘要</TableHead>
                      <TableHead>対象明細</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.journals.map((journal) => {
                      const noInvoiceLines = journal.lines.filter(
                        (l) =>
                          l.taxClassification === "taxable_10_no_invoice" ||
                          l.taxClassification === "taxable_8_no_invoice"
                      );
                      return (
                        <TableRow key={journal.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(journal.id)}
                              onCheckedChange={() => toggleId(journal.id)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {new Date(journal.journalDate).toLocaleDateString("ja-JP")}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {journal.description}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {noInvoiceLines.map((line) => (
                                <div key={line.id} className="text-xs">
                                  <span className="text-muted-foreground">
                                    {line.side === "debit" ? "借" : "貸"}
                                  </span>{" "}
                                  {line.account.name}{" "}
                                  <span className="font-mono">
                                    ¥{line.amount.toLocaleString()}
                                  </span>{" "}
                                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                    {TAX_LABEL[line.taxClassification!] ?? line.taxClassification}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                journal.status === "confirmed"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }
                            >
                              {journal.status === "confirmed" ? "確定" : "下書き"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
