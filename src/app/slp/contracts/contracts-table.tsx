"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Bell,
  ExternalLink,
  Download,
  Zap,
  ZapOff,
  Eye,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import {
  toggleAutoSync,
  manualSync,
  remindContract,
  updateContractStatus,
} from "./actions";
import {
  ContractDetailSheet,
  type ContractDetailRow,
} from "./contract-detail-sheet";

type ContractRow = ContractDetailRow;

type StatusOption = {
  id: number;
  name: string;
  statusType: "progress" | "signed" | "discarded";
};

type Props = {
  rows: ContractRow[];
  statusOptions: StatusOption[];
  contractTypeOptions: string[];
};

const ALL_TYPES = "__all__";

type SortKey =
  | "createdAt"
  | "contractType"
  | "title"
  | "memberName"
  | "memberEmail"
  | "statusName"
  | "sentAt"
  | "signedDate"
  | "lastRemindedAt";

type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortableKey,
  currentSortKey,
  currentSortDir,
  onSort,
  className,
}: {
  label: string;
  sortableKey: SortKey;
  currentSortKey: SortKey;
  currentSortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentSortKey === sortableKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortableKey)}
        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
      >
        {label}
        {active ? (
          currentSortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-gray-300" />
        )}
      </button>
    </TableHead>
  );
}

function statusBadge(statusName: string, statusType: string) {
  const variant =
    statusType === "signed"
      ? "default"
      : statusType === "discarded"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{statusName}</Badge>;
}

/**
 * ソート用コンパレータ。null/undefined は常に末尾に。
 * 文字列は ASCII の `<`/`>` で比較（日本語混在時の localeCompare ハイドレーション
 * 差異を回避するため。日本語を含む列はソート優先順位的に現状実装で問題なし）。
 */
function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir
): number {
  const aNull = a === null || a === undefined || a === "" || a === "-";
  const bNull = b === null || b === undefined || b === "" || b === "-";
  if (aNull && bNull) return 0;
  if (aNull) return 1; // null は常に末尾
  if (bNull) return -1;
  let cmp = 0;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    const sa = String(a);
    const sb = String(b);
    cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function getSortValue(row: ContractRow, key: SortKey): string | number | null {
  switch (key) {
    case "createdAt":
      return row.createdAtRaw;
    case "contractType":
      return row.contractType;
    case "title":
      return row.title;
    case "memberName":
      return row.memberName;
    case "memberEmail":
      return row.memberEmail;
    case "statusName":
      return row.statusName;
    case "sentAt":
      return row.sentAtRaw;
    case "signedDate":
      return row.signedDateRaw;
    case "lastRemindedAt":
      return row.lastRemindedAtRaw;
    default:
      return null;
  }
}

export function ContractsTable({ rows, statusOptions, contractTypeOptions }: Props) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogContractId, setStatusDialogContractId] = useState<number | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  // 種別フィルタ
  const [typeFilter, setTypeFilter] = useState<string>(ALL_TYPES);

  // 検索
  const [searchTerm, setSearchTerm] = useState("");

  // ソート
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // サイドパネル: ID保持にして rows 再フェッチ後も常に最新情報を表示
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailContractId, setDetailContractId] = useState<number | null>(null);
  const detailContract = useMemo(
    () =>
      detailContractId !== null
        ? rows.find((r) => r.id === detailContractId) ?? null
        : null,
    [detailContractId, rows]
  );

  // 万一 rows から該当契約が消えた(削除等)場合はサイドパネルを自動クローズ
  useEffect(() => {
    if (detailSheetOpen && detailContractId !== null && !detailContract) {
      setDetailSheetOpen(false);
      setDetailContractId(null);
    }
  }, [detailSheetOpen, detailContractId, detailContract]);

  // フィルタ + 検索 + ソート
  const filteredRows = useMemo(() => {
    let result = rows;
    // 種別
    if (typeFilter !== ALL_TYPES) {
      result = result.filter((r) => r.contractType === typeFilter);
    }
    // 検索（名前/メール/契約書名/契約番号 部分一致、大文字小文字無視）
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((r) => {
        return (
          r.memberName.toLowerCase().includes(term) ||
          r.memberEmail.toLowerCase().includes(term) ||
          r.title.toLowerCase().includes(term) ||
          (r.contractNumber?.toLowerCase().includes(term) ?? false)
        );
      });
    }
    // ソート
    result = [...result].sort((a, b) =>
      compareValues(getSortValue(a, sortKey), getSortValue(b, sortKey), sortDir)
    );
    return result;
  }, [rows, typeFilter, searchTerm, sortKey, sortDir]);

  const progressRows = filteredRows.filter((r) => r.statusType === "progress");
  const signedRows = filteredRows.filter((r) => r.statusType === "signed");
  const discardedRows = filteredRows.filter((r) => r.statusType === "discarded");

  const handleAction = async (id: number, fn: () => Promise<void>) => {
    setLoadingId(id);
    try {
      await fn();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoadingId(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusDialogContractId || !selectedStatusId) return;
    setStatusSaving(true);
    try {
      const result = await updateContractStatus(
        statusDialogContractId,
        parseInt(selectedStatusId, 10),
        statusNote || undefined
      );
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setStatusDialogOpen(false);
      setSelectedStatusId("");
      setStatusNote("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setStatusSaving(false);
    }
  };

  const openDetail = (contractId: number) => {
    setDetailContractId(contractId);
    setDetailSheetOpen(true);
  };

  const openStatusDialogFor = (contractId: number) => {
    setStatusDialogContractId(contractId);
    setSelectedStatusId("");
    setStatusNote("");
    setStatusDialogOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const renderTable = (data: ContractRow[], showSignedDate: boolean) => (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="種別" sortableKey="contractType" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <SortHeader label="契約書名" sortableKey="title" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <SortHeader label="名前" sortableKey="memberName" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <SortHeader label="メール" sortableKey="memberEmail" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <SortHeader label="ステータス" sortableKey="statusName" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <SortHeader label="送付日時" sortableKey="sentAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            {showSignedDate && (
              <SortHeader label="締結日" sortableKey="signedDate" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            )}
            <SortHeader label="最終リマインド" sortableKey="lastRemindedAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
            <TableHead>同期</TableHead>
            <TableHead>PDF</TableHead>
            <TableHead className="w-[110px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showSignedDate ? 11 : 10}
                className="text-center text-muted-foreground py-8"
              >
                該当する契約書はありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {row.contractType || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="font-medium max-w-[220px] truncate"
                    title={row.title}
                  >
                    {row.title}
                  </TableCell>
                  <TableCell>{row.memberName}</TableCell>
                  <TableCell className="text-sm">{row.memberEmail}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {statusBadge(row.statusName, row.statusType)}
                      {row.memberBounced && (
                        <Badge variant="destructive" className="text-[10px]">
                          メール不達
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{row.sentAt}</TableCell>
                  {showSignedDate && (
                    <TableCell className="text-sm">{row.signedDate}</TableCell>
                  )}
                  <TableCell className="text-sm">{row.lastRemindedAt}</TableCell>
                  <TableCell>
                    {row.cloudsignAutoSync ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300"
                      >
                        自動
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-300"
                      >
                        手動
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.filePath ? (
                      <a
                        href={row.filePath}
                        download={row.fileName ?? undefined}
                        className="text-blue-600 hover:underline"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDetail(row.id)}
                        title="詳細"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={loadingId === row.id}
                            title="その他の操作"
                          >
                            {loadingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openStatusDialogFor(row.id)}
                          >
                            ステータス変更
                          </DropdownMenuItem>
                          {row.cloudsignStatus === "sent" && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAction(row.id, async () => {
                                  const r = await remindContract(row.id);
                                  if (!r.ok) throw new Error(r.error);
                                })
                              }
                            >
                              <Bell className="h-4 w-4 mr-2" />
                              リマインド送付
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {row.cloudsignDocumentId && (
                            <DropdownMenuItem
                              onClick={() =>
                                handleAction(row.id, async () => {
                                  const r = await manualSync(row.id);
                                  if (!r.ok) throw new Error(r.error);
                                })
                              }
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              手動同期
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() =>
                              handleAction(row.id, async () => {
                                const r = await toggleAutoSync(row.id);
                                if (!r.ok) throw new Error(r.error);
                              })
                            }
                          >
                            {row.cloudsignAutoSync ? (
                              <>
                                <ZapOff className="h-4 w-4 mr-2" />
                                自動同期OFF
                              </>
                            ) : (
                              <>
                                <Zap className="h-4 w-4 mr-2" />
                                自動同期ON
                              </>
                            )}
                          </DropdownMenuItem>
                          {row.cloudsignUrl && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a
                                  href={row.cloudsignUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  CloudSignで確認
                                </a>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      {/* 検索・種別フィルタバー */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="名前・メール・契約書名・契約番号で検索"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-600">契約種別:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>すべて ({rows.length})</SelectItem>
              {contractTypeOptions.map((name) => {
                const count = rows.filter((r) => r.contractType === name).length;
                return (
                  <SelectItem key={name} value={name}>
                    {name} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {(searchTerm || typeFilter !== ALL_TYPES) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm("");
              setTypeFilter(ALL_TYPES);
            }}
          >
            クリア
          </Button>
        )}
      </div>

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">
            進行中 ({progressRows.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            締結済み ({signedRows.length})
          </TabsTrigger>
          <TabsTrigger value="discarded">
            破棄 ({discardedRows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>進行中の契約書</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(progressRows, false)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signed">
          <Card>
            <CardHeader>
              <CardTitle>締結済みの契約書</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(signedRows, true)}</CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discarded">
          <Card>
            <CardHeader>
              <CardTitle>破棄された契約書</CardTitle>
            </CardHeader>
            <CardContent>{renderTable(discardedRows, false)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ステータス変更</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>新しいステータス</Label>
              <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                <SelectTrigger>
                  <SelectValue placeholder="ステータスを選択" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>メモ(任意)</Label>
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="変更理由など"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleStatusChange} disabled={!selectedStatusId || statusSaving}>
              {statusSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  変更中...
                </>
              ) : (
                "変更"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContractDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        contract={detailContract}
        loading={loadingId !== null && loadingId === detailContract?.id}
        onOpenStatusDialog={openStatusDialogFor}
        onRemind={(contractId) =>
          handleAction(contractId, async () => {
            const r = await remindContract(contractId);
            if (!r.ok) throw new Error(r.error);
          })
        }
        onManualSync={(contractId) =>
          handleAction(contractId, async () => {
            const r = await manualSync(contractId);
            if (!r.ok) throw new Error(r.error);
          })
        }
        onToggleAutoSync={(contractId) =>
          handleAction(contractId, async () => {
            const r = await toggleAutoSync(contractId);
            if (!r.ok) throw new Error(r.error);
          })
        }
      />
    </>
  );
}
