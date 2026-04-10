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
import { Plus, Trash2, Search, AlertTriangle, Copy, X } from "lucide-react";
import { toast } from "sonner";
import {
  addCompanyRecord,
  deleteCompanyRecord,
  markAsNotDuplicate,
} from "./actions";

const ALL = "__all__";

type DuplicateCandidate = {
  id: number;
  reasons: string[];
  detectedAt: string;
  recordA: {
    id: number;
    companyName: string | null;
    companyPhone: string | null;
    address: string;
    briefingStatus: string | null;
  };
  recordB: {
    id: number;
    companyName: string | null;
    companyPhone: string | null;
    address: string;
    briefingStatus: string | null;
  };
};

type ResolvedEntry = {
  label: string;
  contacts: string[];
};
type AsResolvedEntry = ResolvedEntry & {
  isManual: boolean;
  manualAsReason: string | null;
  autoAsName: string | null;
};

type RecordRow = {
  id: number;
  companyNo: number;
  companyName: string | null;
  primaryContactLineLabel: string | null;
  briefingStatus: string | null;
  briefingDate: string | null;
  consultationStatus: string | null;
  consultationDate: string | null;
  salesStaffName: string | null;
  status1Name: string | null;
  status2Name: string | null;
  asEntries: AsResolvedEntry[];
  referrerEntries: ResolvedEntry[];
  agencyEntries: ResolvedEntry[];
  multipleAgencyWarnings: Array<{
    contactDisplay: string;
    agencyLabels: string[];
  }>;
};

type Props = {
  data: RecordRow[];
  duplicateCandidates: DuplicateCandidate[];
};

export function CompanyRecordsTable({ data, duplicateCandidates }: Props) {
  const router = useRouter();

  // 重複候補パネル
  const [showDuplicates, setShowDuplicates] = useState(false);

  // 検索・フィルタ
  const [searchText, setSearchText] = useState("");
  const [filterStatus1, setFilterStatus1] = useState(ALL);
  const [filterStatus2, setFilterStatus2] = useState(ALL);
  const [filterBriefing, setFilterBriefing] = useState(ALL);
  const [filterConsultation, setFilterConsultation] = useState(ALL);

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
  const consultationOptions = Array.from(
    new Set(data.map((r) => r.consultationStatus).filter((v): v is string => !!v))
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
    if (filterConsultation !== ALL && row.consultationStatus !== filterConsultation) return false;
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

  const handleMarkNotDuplicate = async (
    recordIdA: number,
    recordIdB: number
  ) => {
    if (
      !confirm(
        "この2社は重複ではないとマークしますか？以降この組み合わせは候補に表示されません"
      )
    )
      return;
    try {
      await markAsNotDuplicate(recordIdA, recordIdB);
      toast.success("重複候補から除外しました");
      router.refresh();
    } catch {
      toast.error("操作に失敗しました");
    }
  };

  return (
    <>
      {/* 重複候補パネル */}
      {duplicateCandidates.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50">
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => setShowDuplicates(!showDuplicates)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              <span className="text-sm font-medium text-amber-900">
                重複候補が{duplicateCandidates.length}件あります
              </span>
            </div>
            <Button variant="ghost" size="sm">
              {showDuplicates ? "閉じる" : "開く"}
            </Button>
          </div>
          {showDuplicates && (
            <div className="border-t border-amber-200 p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {duplicateCandidates.map((cand) => (
                <div
                  key={cand.id}
                  className="bg-white border border-amber-200 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-700">
                        一致理由:
                      </span>
                      {cand.reasons.map((r) => (
                        <Badge
                          key={r}
                          variant="outline"
                          className="text-xs border-amber-400 text-amber-700"
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        asChild
                      >
                        <Link
                          href={`/slp/companies/merge?a=${cand.recordA.id}&b=${cand.recordB.id}`}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          統合する
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-600"
                        onClick={() =>
                          handleMarkNotDuplicate(
                            cand.recordA.id,
                            cand.recordB.id
                          )
                        }
                      >
                        <X className="h-3 w-3 mr-1" />
                        重複ではない
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[cand.recordA, cand.recordB].map((rec) => (
                      <Link
                        key={rec.id}
                        href={`/slp/companies/${rec.id}`}
                        className="border border-slate-200 rounded p-2 hover:border-blue-400"
                      >
                        <div className="font-medium text-blue-700">
                          ID {rec.id}: {rec.companyName ?? "(未登録)"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {rec.companyPhone && `📞 ${rec.companyPhone}`}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {rec.address && `📍 ${rec.address}`}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        <Select value={filterConsultation} onValueChange={setFilterConsultation}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="導入希望商談" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>すべて（導入希望商談）</SelectItem>
            {consultationOptions.map((s) => (
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

      {/* テーブル本体（13列構成） */}
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
              <TableHead className="w-[120px]">導入希望商談</TableHead>
              <TableHead className="w-[160px]">導入希望商談日</TableHead>
              <TableHead className="min-w-[200px]">AS担当</TableHead>
              <TableHead className="min-w-[220px]">紹介者</TableHead>
              <TableHead className="min-w-[220px]">代理店</TableHead>
              <TableHead className="w-[80px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  {data.length === 0
                    ? "企業名簿にレコードがありません"
                    : "条件に一致する企業がありません"}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row) => (
                <TableRow key={row.id} className="group/row align-top">
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
                      ) : row.primaryContactLineLabel ? (
                        <span className="text-muted-foreground text-xs italic">
                          {row.primaryContactLineLabel} から作成
                        </span>
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
                  <TableCell className="text-sm">
                    {row.consultationStatus ? (
                      <Badge variant="outline">{row.consultationStatus}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.consultationDate ?? <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  {/* AS担当 */}
                  <TableCell className="text-sm">
                    {row.asEntries.length === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="space-y-1">
                        {row.asEntries.map((entry, i) => (
                          <div key={i}>
                            <div className="font-medium">
                              {entry.label}
                              <span className="text-muted-foreground text-xs ml-1">
                                ({entry.contacts.join(", ")})
                              </span>
                            </div>
                            {entry.isManual && (
                              <div
                                className="text-xs text-amber-600 ml-1"
                                title={entry.manualAsReason ?? ""}
                              >
                                ↳ 元: {entry.autoAsName ?? "なし"} / 理由: {entry.manualAsReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {/* 紹介者 */}
                  <TableCell className="text-sm">
                    {row.referrerEntries.length === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="space-y-1">
                        {row.referrerEntries.map((entry, i) => (
                          <div key={i}>
                            <span className="font-medium">{entry.label}</span>
                            <span className="text-muted-foreground text-xs ml-1">
                              ({entry.contacts.join(", ")})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {/* 代理店 */}
                  <TableCell className="text-sm">
                    {row.agencyEntries.length === 0 ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <div className="space-y-1">
                        {row.agencyEntries.map((entry, i) => (
                          <div key={i}>
                            <span className="font-medium">{entry.label}</span>
                            <span className="text-muted-foreground text-xs ml-1">
                              ({entry.contacts.join(", ")})
                            </span>
                          </div>
                        ))}
                        {row.multipleAgencyWarnings.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>
                              1人の担当者から複数の1次代理店が見つかりました
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
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
