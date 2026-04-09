"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { addCompanyRecord, deleteCompanyRecord } from "./actions";

const ALL = "__all__";

type RecordRow = {
  id: number;
  companyNo: number;
  companyName: string | null;
  briefingStatus: string | null;
  briefingDate: string | null;
  salesStaffName: string | null;
  status1Name: string | null;
  status2Name: string | null;
};

type Props = {
  data: RecordRow[];
};

export function CompanyRecordsTable({ data }: Props) {
  const router = useRouter();

  // 検索・フィルタ
  const [searchText, setSearchText] = useState("");
  const [filterStatus1, setFilterStatus1] = useState(ALL);
  const [filterStatus2, setFilterStatus2] = useState(ALL);
  const [filterBriefing, setFilterBriefing] = useState(ALL);

  // 絞り込み候補（表示中データから自動生成）
  const status1Options = Array.from(
    new Set(data.map((r) => r.status1Name).filter((v): v is string => !!v))
  );
  const status2Options = Array.from(
    new Set(data.map((r) => r.status2Name).filter((v): v is string => !!v))
  );
  const briefingOptions = Array.from(
    new Set(data.map((r) => r.briefingStatus).filter((v): v is string => !!v))
  );

  const filteredData = data.filter((row) => {
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      const target = `${row.companyNo} ${row.companyName ?? ""} ${row.salesStaffName ?? ""}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    if (filterStatus1 !== ALL && row.status1Name !== filterStatus1) return false;
    if (filterStatus2 !== ALL && row.status2Name !== filterStatus2) return false;
    if (filterBriefing !== ALL && row.briefingStatus !== filterBriefing) return false;
    return true;
  });

  const handleAddRecord = async () => {
    try {
      const { id } = await addCompanyRecord();
      toast.success("レコードを追加しました");
      // 新規作成後は詳細ページへ遷移して、すぐに情報入力できるようにする
      router.push(`/slp/companies/${id}`);
    } catch {
      toast.error("追加に失敗しました");
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("このレコードを削除しますか？")) return;
    try {
      await deleteCompanyRecord(id);
      toast.success("削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  return (
    <>
      {/* 検索・フィルタ・追加 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="企業名・No・担当営業で検索"
            className="pl-8"
          />
        </div>
        <Select value={filterStatus1} onValueChange={setFilterStatus1}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ステータス①" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（ステータス①）</SelectItem>
            {status1Options.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus2} onValueChange={setFilterStatus2}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="ステータス②" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（ステータス②）</SelectItem>
            {status2Options.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBriefing} onValueChange={setFilterBriefing}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="概要案内" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（概要案内）</SelectItem>
            {briefingOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={handleAddRecord}>
            <Plus className="h-4 w-4 mr-2" />
            新規企業を追加
          </Button>
        </div>
      </div>

      {/* テーブル本体（8列構成、シンプル） */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">企業No.</TableHead>
              <TableHead>企業名</TableHead>
              <TableHead className="w-[140px]">ステータス①</TableHead>
              <TableHead className="w-[140px]">ステータス②</TableHead>
              <TableHead className="w-[140px]">担当営業</TableHead>
              <TableHead className="w-[120px]">概要案内</TableHead>
              <TableHead className="w-[160px]">概要案内日</TableHead>
              <TableHead className="w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {data.length === 0
                    ? "企業名簿にレコードがありません"
                    : "条件に一致する企業がありません"}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => (
                <TableRow key={row.id} className="group/row">
                  <TableCell>
                    <Link
                      href={`/slp/companies/${row.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {row.companyNo}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/slp/companies/${row.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {row.companyName ? (
                        <span>{row.companyName}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">(未登録)</span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.status1Name ? (
                      <Badge variant="outline">{row.status1Name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.status2Name ? (
                      <Badge variant="outline">{row.status2Name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.salesStaffName ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.briefingStatus ? (
                      <Badge variant="outline">{row.briefingStatus}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.briefingDate ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteRecord(row.id)}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        ※ 企業名・企業No. をクリックすると、その企業の詳細・編集ページが開きます。
      </p>
    </>
  );
}
