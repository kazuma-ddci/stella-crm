"use client";

/**
 * BankStatementEntry を 請求/支払グループに紐付けるとき、
 * そのグループに既存の手動入力レコード（バンクリンク無し）がある場合の
 * 「上書き / 両方残す / キャンセル」3択ダイアログ。
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type {
  ConflictResolution,
  LinkConflict,
} from "@/app/accounting/statements/link-actions";

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

export function ConflictResolutionDialog({
  open,
  conflicts,
  onResolve,
  onCancel,
}: {
  open: boolean;
  conflicts: LinkConflict[];
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            手動で入力された記録があります
          </DialogTitle>
          <DialogDescription>
            紐付け先のグループに、すでにスタッフが手動で入力した
            入金/支払の記録があります。どう処理しますか？
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {conflicts.map((c) => (
            <div key={`${c.groupKind}-${c.groupId}`} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  {c.groupKind === "invoice" ? "請求" : "支払"}
                </Badge>
                <span className="text-sm font-medium">{c.groupLabel}</span>
              </div>
              <div className="text-xs text-muted-foreground mb-1">
                既存の手動入力 {c.manualRecords.length} 件:
              </div>
              <ul className="text-xs space-y-1 ml-4">
                {c.manualRecords.map((r) => (
                  <li key={r.id} className="flex gap-2">
                    <span>{r.date}</span>
                    <span className="font-medium">{fmt(r.amount)} 円</span>
                    {r.comment && (
                      <span className="text-muted-foreground truncate">
                        — {r.comment}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
          <p className="font-medium">処理の選び方</p>
          <p>
            <strong>上書きする</strong> … 手動の記録を削除して、銀行データを正の記録として保存します。プロジェクト側がプレビューで入れていた仮データを正データに置き換える時に選びます。
          </p>
          <p>
            <strong>両方残す</strong> … 手動の記録と銀行データの両方が記録として共存します。別々の入金として扱う場合に選びます。
          </p>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="secondary" onClick={() => onResolve("keep_both")}>
            両方残す
          </Button>
          <Button onClick={() => onResolve("overwrite")}>
            上書きする（手動を削除）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
