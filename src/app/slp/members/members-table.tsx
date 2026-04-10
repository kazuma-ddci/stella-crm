"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomRenderers, CustomAction } from "@/components/crud-table";
import { addMember, updateMember, deleteMember, remindMember, sendContractToMember, clearResubmitted, sendForm5Notification, bulkSendContracts } from "./actions";
import { Bell, Send, ScrollText, AlertTriangle, Loader2, Settings, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { SlpContractModal } from "./slp-contract-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  data: Record<string, unknown>[];
  memberOptions: { value: string; label: string }[];
  contractStatusOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
  autoSendContract: boolean;
};

const statusOptions = [
  { value: "契約書未送付", label: "契約書未送付" },
  { value: "契約書送付済", label: "契約書送付済" },
  { value: "組合員契約書締結", label: "組合員契約書締結" },
  { value: "契約破棄", label: "契約破棄" },
  { value: "送付エラー", label: "送付エラー" },
];

const memberCategoryOptions = [
  { value: "個人（法人代表・役員・従業員）", label: "個人（法人代表・役員・従業員）" },
  { value: "法人担当者", label: "法人担当者" },
  { value: "代理店", label: "代理店" },
];

export function MembersTable({ data, memberOptions, contractStatusOptions, contractTypeOptions, autoSendContract }: Props) {
  const router = useRouter();
  const [form5DialogOpen, setForm5DialogOpen] = useState(false);
  const [form5NotifyCount, setForm5NotifyCount] = useState(0);
  const pendingUpdateRef = useRef<{ id: number; formData: Record<string, unknown> } | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null);

  // 一括送付モーダル
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number; results: { id: number; name: string; success: boolean; error?: string }[] } | null>(null);

  // 未送付・送付エラーのメンバー
  const unsendableMembers = data.filter(
    (d) => (d.status === "契約書未送付" || d.status === "送付エラー") && d.email
  );

  // LINE未紐付けメンバー（SlpLineFriendが存在しない）
  const unlinkedMembers = data.filter((d) => d.lineLinked === false);

  // 紹介者未通知メンバー（締結済み・LINE紐付き・現在のfree1に未通知）
  const unnotifiedMembers = data.filter((d) => d.referrerUnnotified === true);

  // 紹介者通知の確認ダイアログ
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<{ id: number; name: string } | null>(null);
  const [notifying, setNotifying] = useState(false);

  const handleSendForm5 = async () => {
    if (!notifyTarget) return;
    setNotifying(true);
    try {
      const result = await sendForm5Notification(notifyTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${notifyTarget.name}さんの紹介者に通知を送信しました`);
      setNotifyDialogOpen(false);
      setNotifyTarget(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "通知送信に失敗しました";
      toast.error(msg);
    } finally {
      setNotifying(false);
    }
  };

  const openBulkModal = () => {
    // デフォルト全員チェック
    setSelectedIds(new Set(unsendableMembers.map((d) => d.id as number)));
    setBulkResult(null);
    setBulkModalOpen(true);
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === unsendableMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unsendableMembers.map((d) => d.id as number)));
    }
  };

  const handleBulkSend = async () => {
    if (selectedIds.size === 0) return;
    setBulkSending(true);
    try {
      const result = await bulkSendContracts(Array.from(selectedIds));
      setBulkResult(result);
      if (result.failed > 0) {
        toast.warning(`${result.succeeded}名に送付成功、${result.failed}名が失敗`);
      } else {
        toast.success(`${result.succeeded}名に契約書を送付しました`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "一括送付に失敗しました");
    } finally {
      setBulkSending(false);
    }
  };

  const columns: ColumnDef[] = [
    { key: "id", header: "No.", editable: false },
    { key: "lineNo", header: "LINE番号", editable: false },
    { key: "name", header: "氏名", type: "text", required: true, filterable: true },
    { key: "email", header: "メールアドレス", type: "text", filterable: true },
    { key: "status", header: "ステータス", type: "select", options: statusOptions, filterable: true },
    { key: "contractSentDate", header: "契約書送付日", type: "text", editable: false },
    { key: "contractSignedDate", header: "契約締結日", type: "text", editable: false },
    { key: "formSubmittedAt", header: "フォーム送信日時", type: "text", editable: false },
    { key: "position", header: "役職", type: "text" },
    { key: "company", header: "会社", type: "text", filterable: true },
    { key: "memberCategory", header: "入会者区分", type: "select", options: memberCategoryOptions, filterable: true },
    { key: "lineName", header: "LINE名", type: "text" },
    { key: "uid", header: "UID", type: "text", required: true, editableOnCreate: true },
    { key: "phone", header: "電話番号", type: "text" },
    { key: "address", header: "住所", type: "text" },
    { key: "referrerUid", header: "紹介者", type: "select", options: memberOptions, searchable: true, hidden: true },
    { key: "referrerDisplay", header: "紹介者", editable: false, filterable: true },
    { key: "note", header: "備考", type: "textarea" },
    { key: "memo", header: "メモ", type: "textarea" },
    { key: "documentId", header: "documentID", type: "text" },
    { key: "cloudsignUrl", header: "クラウドサインURL", type: "text" },
    { key: "reminderCount", header: "リマインド回数", type: "number", defaultValue: 0 },
    { key: "lastReminderSentAt", header: "直近リマインド日時", type: "text", editable: false },
    { key: "emailChangeCount", header: "メアド変更回数", type: "number", editable: false },
    { key: "watermarkCode", header: "透かしコード", type: "text", editable: false },
  ];

  const customRenderers: CustomRenderers = {
    referrerDisplay: (value) => {
      if (!value) return "-";
      return String(value);
    },
    status: (value, row) => {
      const resubmitted = Boolean(row?.resubmitted);
      const statusStr = String(value || "");
      const isError = statusStr === "送付エラー";
      const isBounced = Boolean(row?.cloudsignBounced);
      const bouncedAt = row?.cloudsignBouncedAt as string | null | undefined;
      const bouncedEmail = row?.cloudsignBouncedEmail as string | null | undefined;

      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {isError ? (
            <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-semibold px-2 py-0.5 rounded-full">
              送付エラー
            </span>
          ) : (
            <span>{statusStr || "-"}</span>
          )}
          {isBounced && (
            <span
              className="inline-flex items-center bg-red-200 text-red-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-red-400"
              title={`CloudSignメール送信失敗${bouncedEmail ? `: ${bouncedEmail}` : ""}${bouncedAt ? ` (${bouncedAt})` : ""}`}
            >
              ✉️送信失敗
            </span>
          )}
          {resubmitted && (
            <span
              className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer hover:bg-amber-200"
              title="未締結のまま再フォーム送信されました。クリックで通知をクリアします。"
              onClick={async (e) => {
                e.stopPropagation();
                const id = row?.id as number;
                if (id) {
                  const result = await clearResubmitted(id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("通知をクリアしました");
                  router.refresh();
                }
              }}
            >
              再送信
            </span>
          )}
        </div>
      );
    },
  };

  const customActions: CustomAction[] = [
    {
      label: "契約管理",
      icon: <ScrollText className="h-4 w-4" />,
      onClick: async (row) => {
        setSelectedMember({ id: row.id as number, name: row.name as string });
        setContractModalOpen(true);
      },
    },
    {
      label: "新規契約書送付",
      icon: <Send className="h-4 w-4" />,
      onClick: async (row) => {
        if (row.status === "組合員契約書締結") {
          toast.error("この組合員は契約締結済みです");
          return;
        }
        if (!row.email) {
          toast.error("メールアドレスが登録されていません");
          return;
        }
        const id = row.id as number;
        const name = row.name as string;
        const email = row.email as string;
        if (!confirm(`${name}さん（${email}）に新規契約書を送付しますか？`)) return;
        try {
          const result = await sendContractToMember(id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`${name}さんに契約書を送付しました`);
          router.refresh();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "契約書送付に失敗しました";
          toast.error(msg);
        }
      },
    },
    {
      label: "リマインド送付",
      icon: <Bell className="h-4 w-4" />,
      onClick: async (row) => {
        if (row.status !== "契約書送付済" || !row.documentId) {
          toast.error("この組合員はリマインド対象ではありません");
          return;
        }
        const id = row.id as number;
        const name = row.name as string;
        if (!confirm(`${name}さんにリマインドを送付しますか？`)) return;
        try {
          const result = await remindMember(id);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`${name}さんにリマインドを送付しました`);
          router.refresh();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "リマインド送付に失敗しました";
          toast.error(msg);
        }
      },
    },
    {
      label: "紹介者通知",
      icon: <UserCheck className="h-4 w-4" />,
      onClick: (row) => {
        if (!row.referrerUnnotified) {
          toast.error("このメンバーは紹介者通知の対象ではありません");
          return;
        }
        setNotifyTarget({ id: row.id as number, name: row.name as string });
        setNotifyDialogOpen(true);
      },
    },
  ];

  const handleAdd = async (formData: Record<string, unknown>) => {
    const result = await addMember(formData);
    if (result.ok) router.refresh();
    return result;
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    // ステータスが「組合員契約書締結」に変更された場合、通知確認ダイアログを表示
    const currentRow = data.find((d) => d.id === id);
    const newStatus = formData.status as string | undefined;
    const oldStatus = currentRow?.status as string | undefined;

    if (
      newStatus === "組合員契約書締結" &&
      oldStatus !== "組合員契約書締結"
    ) {
      pendingUpdateRef.current = { id, formData };
      setForm5NotifyCount((currentRow?.form5NotifyCount as number) ?? 0);
      setForm5DialogOpen(true);
      return;
    }

    const result = await updateMember(id, formData);
    if (result.ok) router.refresh();
    return result;
  };

  const handleForm5Confirm = useCallback(async (sendNotification: boolean) => {
    setForm5DialogOpen(false);
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    pendingUpdateRef.current = null;

    try {
      const result = await updateMember(pending.id, pending.formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (sendNotification) {
        const r2 = await sendForm5Notification(pending.id);
        if (!r2.ok) {
          toast.error(r2.error);
        } else {
          toast.success("紹介者に契約締結通知を送信しました");
        }
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "更新に失敗しました";
      toast.error(msg);
    }
  }, [router]);

  const handleDelete = async (id: number) => {
    const result = await deleteMember(id);
    if (result.ok) router.refresh();
    return result;
  };

  return (
    <>
      {/* 自動送付OFF警告バナー */}
      {!autoSendContract && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">
              契約書の自動送付が停止中です
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              フォームから登録されたメンバーには、手動で契約書を送付してください。
            </p>
          </div>
          <Link href="/slp/settings/project">
            <Button variant="outline" size="sm" className="shrink-0">
              <Settings className="h-4 w-4 mr-1" />
              設定を変更
            </Button>
          </Link>
        </div>
      )}

      {/* LINE未紐付け・紹介者未通知の警告バナー */}
      {(unlinkedMembers.length > 0 || unnotifiedMembers.length > 0) && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          {unlinkedMembers.length > 0 && (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  公式LINE友達情報に未登録の組合員: {unlinkedMembers.length}名
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  該当行が赤色背景で表示されています。プロライン同期が遅延している可能性があります。同期完了後に自動的に紐付きます。
                </p>
              </div>
            </div>
          )}
          {unnotifiedMembers.length > 0 && (
            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  紹介者へ契約締結通知が未送信の組合員: {unnotifiedMembers.length}名
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  該当行が黄色背景で表示されています。締結後にLINEが紐付けされた、または紹介者UIDが変更されたケースです。操作列の「紹介者通知」ボタンから手動で送信してください。
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 一括送付ボタン */}
      {unsendableMembers.length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={openBulkModal}>
            <Users className="h-4 w-4 mr-1" />
            未送付メンバーに一括送付（{unsendableMembers.length}名）
          </Button>
        </div>
      )}

      <CrudTable
        data={data}
        columns={columns}
        title="組合員"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        customRenderers={customRenderers}
        customActions={customActions}
        rowClassName={(row) => {
          // CloudSign送信失敗は最優先で強い赤
          if (row.cloudsignBounced === true) return "bg-red-100 hover:bg-red-200";
          if (row.lineLinked === false) return "bg-red-50 hover:bg-red-100";
          if (row.referrerUnnotified === true) return "bg-amber-50 hover:bg-amber-100";
          return undefined;
        }}
        emptyMessage="組合員が登録されていません"
      />

      {selectedMember && (
        <SlpContractModal
          open={contractModalOpen}
          onOpenChange={setContractModalOpen}
          memberId={selectedMember.id}
          memberName={selectedMember.name}
          contractStatusOptions={contractStatusOptions}
          contractTypeOptions={contractTypeOptions}
        />
      )}

      {/* 一括送付モーダル */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>契約書の一括送付</DialogTitle>
          </DialogHeader>

          {bulkResult ? (
            // 送付結果
            <div className="space-y-3">
              <div className="flex gap-3">
                <Badge variant="default">{bulkResult.succeeded}名 成功</Badge>
                {bulkResult.failed > 0 && <Badge variant="destructive">{bulkResult.failed}名 失敗</Badge>}
              </div>
              <div className="border rounded-lg overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>結果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResult.results.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.name}</TableCell>
                        <TableCell>
                          {r.success ? (
                            <Badge variant="default" className="text-xs">成功</Badge>
                          ) : (
                            <span className="text-xs text-red-600">{r.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button onClick={() => setBulkModalOpen(false)}>閉じる</Button>
              </DialogFooter>
            </div>
          ) : (
            // 送付対象選択
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                送付対象のメンバーを選択してください。チェックを外すと送付から除外されます。
              </p>
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedIds.size === unsendableMembers.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  全選択（{selectedIds.size}/{unsendableMembers.length}名）
                </span>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>名前</TableHead>
                      <TableHead>メール</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unsendableMembers.map((m) => {
                      const id = m.id as number;
                      const checked = selectedIds.has(id);
                      return (
                        <TableRow
                          key={id}
                          className={`cursor-pointer ${!checked ? "opacity-50" : ""}`}
                          onClick={() => toggleSelected(id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleSelected(id)}
                            />
                          </TableCell>
                          <TableCell className="text-sm font-medium">{m.name as string}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.email as string}</TableCell>
                          <TableCell>
                            {m.status === "送付エラー" ? (
                              <Badge variant="destructive" className="text-xs">送付エラー</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">未送付</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleBulkSend}
                  disabled={selectedIds.size === 0 || bulkSending}
                >
                  {bulkSending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  {bulkSending ? "送付中..." : `${selectedIds.size}名に送付`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 手動「紹介者通知」確認ダイアログ */}
      <AlertDialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>紹介者に契約締結通知を送信</AlertDialogTitle>
            <AlertDialogDescription>
              {notifyTarget?.name}さんの現在の紹介者にForm5（契約締結完了）通知を送信します。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifying}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSendForm5();
              }}
              disabled={notifying}
            >
              {notifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  送信中...
                </>
              ) : (
                "送信する"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={form5DialogOpen} onOpenChange={setForm5DialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>紹介者への契約締結通知</AlertDialogTitle>
            <AlertDialogDescription>
              {form5NotifyCount === 0
                ? "紹介者に契約書締結を通知しますか？"
                : `すでに通知を${form5NotifyCount}回送信していますが、再度通知しますか？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleForm5Confirm(false)}>
              いいえ（通知なし）
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleForm5Confirm(true)}>
              はい（通知する）
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
