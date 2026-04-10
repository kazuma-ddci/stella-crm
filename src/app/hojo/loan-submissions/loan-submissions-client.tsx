"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { InlineCell } from "@/components/inline-cell";
import { updateLoanStaffMemo } from "./actions";

type RowData = {
  id: number;
  formType: string;
  companyName: string;
  representName: string;
  email: string;
  phone: string;
  vendorName: string;
  submittedAt: string;
  vendorMemo: string;
  lenderMemo: string;
  staffMemo: string;
};

function SubmissionTable({
  data,
  vendorFilter,
  canEdit,
}: {
  data: RowData[];
  vendorFilter: string;
  canEdit: boolean;
}) {
  const router = useRouter();

  const handleStaffMemoSave = async (id: number, value: string) => {
    const result = await updateLoanStaffMemo(id, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const filtered = vendorFilter
    ? data.filter((r) => r.vendorName === vendorFilter)
    : data;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        フォーム回答がまだありません
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">No.</TableHead>
            <TableHead>ベンダー</TableHead>
            <TableHead>会社名/屋号</TableHead>
            <TableHead>代表者/氏名</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>電話番号</TableHead>
            <TableHead>回答日時</TableHead>
            <TableHead>ベンダー備考</TableHead>
            <TableHead>貸金業社備考</TableHead>
            <TableHead>弊社備考</TableHead>
            <TableHead className="w-20 sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              操作
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row, idx) => (
            <TableRow key={row.id} className="group/row">
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {row.vendorName || "（不明）"}
              </TableCell>
              <TableCell className="font-medium">{row.companyName}</TableCell>
              <TableCell>{row.representName}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.phone}</TableCell>
              <TableCell>
                {new Date(row.submittedAt).toLocaleString("ja-JP", {
                  timeZone: "Asia/Tokyo",
                })}
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.vendorMemo || "-"}</span>
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.lenderMemo || "-"}</span>
              </TableCell>
              <TableCell className="max-w-[200px]">
                {canEdit ? (
                  <InlineCell value={row.staffMemo} onSave={(v) => handleStaffMemoSave(row.id, v)} type="textarea">
                    <span className="truncate block">{row.staffMemo || "-"}</span>
                  </InlineCell>
                ) : (
                  <span className="truncate block">{row.staffMemo || "-"}</span>
                )}
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(`/hojo/loan-submissions/${row.id}`)
                  }
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function LoanSubmissionsClient({
  corporateData,
  individualData,
  vendors,
  canEdit,
}: {
  corporateData: RowData[];
  individualData: RowData[];
  vendors: { id: number; name: string }[];
  canEdit: boolean;
}) {
  const [vendorFilter, setVendorFilter] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">ベンダー:</span>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.name}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="corporate">
        <TabsList>
          <TabsTrigger value="corporate">
            法人 ({vendorFilter && vendorFilter !== "all"
              ? corporateData.filter((r) => r.vendorName === vendorFilter).length
              : corporateData.length})
          </TabsTrigger>
          <TabsTrigger value="individual">
            個人事業主 ({vendorFilter && vendorFilter !== "all"
              ? individualData.filter((r) => r.vendorName === vendorFilter).length
              : individualData.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="corporate" className="mt-4">
          <SubmissionTable
            data={corporateData}
            vendorFilter={vendorFilter === "all" ? "" : vendorFilter}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="individual" className="mt-4">
          <SubmissionTable
            data={individualData}
            vendorFilter={vendorFilter === "all" ? "" : vendorFilter}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
