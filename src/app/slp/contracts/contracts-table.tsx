"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  toggleAutoSync,
  manualSync,
  remindContract,
  updateContractStatus,
} from "./actions";

type ContractRow = {
  id: number;
  memberName: string;
  memberEmail: string;
  title: string;
  statusName: string;
  statusType: "progress" | "signed" | "discarded";
  cloudsignStatus: string | null;
  cloudsignAutoSync: boolean;
  cloudsignDocumentId: string | null;
  cloudsignUrl: string | null;
  sentAt: string;
  completedAt: string;
  signedDate: string;
  lastRemindedAt: string;
  filePath: string | null;
  fileName: string | null;
  note: string | null;
  createdAt: string;
};

type StatusOption = {
  id: number;
  name: string;
  statusType: "progress" | "signed" | "discarded";
};

type Props = {
  rows: ContractRow[];
  statusOptions: StatusOption[];
};

function statusBadge(statusName: string, statusType: string) {
  const variant =
    statusType === "signed"
      ? "default"
      : statusType === "discarded"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{statusName}</Badge>;
}

export function ContractsTable({ rows, statusOptions }: Props) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogContractId, setStatusDialogContractId] = useState<number | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const progressRows = rows.filter((r) => r.statusType === "progress");
  const signedRows = rows.filter((r) => r.statusType === "signed");
  const discardedRows = rows.filter((r) => r.statusType === "discarded");

  const handleAction = async (id: number, _action: string, fn: () => Promise<void>) => {
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

  const renderTable = (data: ContractRow[], showSignedDate: boolean) => (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名前</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>送付日時</TableHead>
            {showSignedDate && <TableHead>締結日</TableHead>}
            <TableHead>最終リマインド</TableHead>
            <TableHead>同期</TableHead>
            <TableHead>PDF</TableHead>
            <TableHead className="w-[80px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showSignedDate ? 9 : 8} className="text-center text-muted-foreground py-8">
                該当する契約書はありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.memberName}</TableCell>
                <TableCell className="text-sm">{row.memberEmail}</TableCell>
                <TableCell>{statusBadge(row.statusName, row.statusType)}</TableCell>
                <TableCell className="text-sm">{row.sentAt}</TableCell>
                {showSignedDate && <TableCell className="text-sm">{row.signedDate}</TableCell>}
                <TableCell className="text-sm">{row.lastRemindedAt}</TableCell>
                <TableCell>
                  {row.cloudsignAutoSync ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">自動</Badge>
                  ) : (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">手動</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.filePath ? (
                    <a href={row.filePath} download={row.fileName} className="text-blue-600 hover:underline">
                      <Download className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={loadingId === row.id}>
                        {loadingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setStatusDialogContractId(row.id);
                          setStatusDialogOpen(true);
                        }}
                      >
                        ステータス変更
                      </DropdownMenuItem>
                      {row.cloudsignStatus === "sent" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleAction(row.id, "remind", async () => {
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
                            handleAction(row.id, "sync", async () => {
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
                          handleAction(row.id, "autoSync", async () => {
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
                            <a href={row.cloudsignUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              CloudSignで確認
                            </a>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
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
              <Label>メモ（任意）</Label>
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
    </>
  );
}
