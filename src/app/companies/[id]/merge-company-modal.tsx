"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CompanySearchCombobox } from "@/components/company-search-combobox";
import { Merge, AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { getMergePreview, executeMerge } from "./merge-actions";
import type { MergePreview, MergeResolution } from "@/types/company-merge";

type Props = {
  companyId: number;
  companyName: string;
  companyCode: string;
};

type Step = "select" | "preview" | "confirm" | "result";

export function MergeCompanyModal({ companyId, companyName, companyCode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");

  // Step 1: 企業選択
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [duplicateName, setDuplicateName] = useState<string>("");

  // Step 2: プレビュー
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [stpCompanyResolution, setStpCompanyResolution] = useState<
    "keep_a" | "keep_b" | "keep_both"
  >("keep_a");
  const [stpAgentResolution, setStpAgentResolution] = useState<
    "keep_a" | "keep_b" | "keep_both"
  >("keep_a");

  // Step 3: 確認
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Step 4: 結果
  const [resultMessage, setResultMessage] = useState<string>("");
  const [resultWarnings, setResultWarnings] = useState<string[]>([]);
  const [resultError, setResultError] = useState<string>("");

  const reset = useCallback(() => {
    setStep("select");
    setDuplicateId(null);
    setDuplicateName("");
    setPreview(null);
    setLoading(false);
    setStpCompanyResolution("keep_a");
    setStpAgentResolution("keep_a");
    setResultMessage("");
    setResultWarnings([]);
    setResultError("");
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      reset();
    }
  };

  // Step 1 → Step 2: プレビュー取得
  const handleLoadPreview = async () => {
    if (!duplicateId) return;
    setLoading(true);
    try {
      const data = await getMergePreview(companyId, duplicateId);
      setPreview(data);
      setStep("preview");
    } catch (error) {
      console.error("Preview failed:", error);
      setResultError("プレビューの取得に失敗しました");
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3: 確認ダイアログ
  const handleConfirmStart = () => {
    setConfirmOpen(true);
  };

  // Step 3 → Step 4: マージ実行
  const handleExecuteMerge = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setStep("result");
    try {
      const resolution: MergeResolution = {};
      if (preview?.stpCompanyConflicts && preview.stpCompanyConflicts.length > 0) {
        resolution.stpCompanyResolution = stpCompanyResolution;
      }
      if (preview?.stpAgentConflicts && preview.stpAgentConflicts.length > 0) {
        resolution.stpAgentResolution = stpAgentResolution;
      }
      const result = await executeMerge(companyId, duplicateId!, resolution);
      if (result.success) {
        setResultMessage("企業の統合が完了しました");
        setResultWarnings(result.warnings || []);
      } else {
        setResultError(result.error || "統合処理に失敗しました");
      }
    } catch (error) {
      console.error("Merge failed:", error);
      setResultError("統合処理に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (resultMessage) {
      router.refresh();
    }
  };

  const totalDuplicateRecords = preview
    ? Object.values(preview.duplicate.relatedData).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Merge className="h-4 w-4 mr-2" />
            企業を統合
          </Button>
        </DialogTrigger>
        <DialogContent size="form" className="max-h-[85vh] overflow-y-auto">
          {/* Step 1: 企業選択 */}
          {step === "select" && (
            <>
              <DialogHeader>
                <DialogTitle>企業の統合</DialogTitle>
                <DialogDescription>
                  統合元（重複）の企業を選択してください。選択した企業のデータが
                  <strong>{companyName}</strong>（{companyCode}）に統合されます。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium">統合先（残す企業）</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {companyCode}
                    </span>
                    <span className="font-medium">{companyName}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
                </div>
                <div>
                  <Label className="text-sm font-medium">統合元（重複企業）</Label>
                  <div className="mt-1">
                    <CompanySearchCombobox
                      value={duplicateId}
                      onChange={(id, company) => {
                        if (id === companyId) return; // 自社を除外
                        setDuplicateId(id);
                        setDuplicateName(company?.name || "");
                      }}
                      placeholder="統合元の企業を検索..."
                    />
                  </div>
                  {duplicateId === companyId && (
                    <p className="text-sm text-destructive mt-1">自分自身は選択できません</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleLoadPreview}
                  disabled={!duplicateId || duplicateId === companyId || loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  次へ
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: プレビュー + 衝突解決 */}
          {step === "preview" && preview && (
            <>
              <DialogHeader>
                <DialogTitle>統合プレビュー</DialogTitle>
                <DialogDescription>
                  以下のデータが統合されます。内容を確認してください。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* 統合サマリー */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-md">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      統合先（残す企業）
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {preview.survivor.companyCode}
                    </div>
                    <div className="font-medium">{preview.survivor.name}</div>
                  </div>
                  <div className="p-3 border rounded-md border-destructive/50">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      統合元（非表示になる企業）
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {preview.duplicate.companyCode}
                    </div>
                    <div className="font-medium">{preview.duplicate.name}</div>
                  </div>
                </div>

                {/* 自動統合されるデータ */}
                <div>
                  <h4 className="text-sm font-medium mb-2">自動統合されるデータ</h4>
                  <div className="space-y-1 text-sm">
                    {preview.duplicate.relatedData.locations > 0 && (
                      <div>拠点: {preview.duplicate.relatedData.locations}件</div>
                    )}
                    {preview.duplicate.relatedData.contacts > 0 && (
                      <div>担当者: {preview.duplicate.relatedData.contacts}件</div>
                    )}
                    {preview.duplicate.relatedData.bankAccounts > 0 && (
                      <div>銀行口座: {preview.duplicate.relatedData.bankAccounts}件</div>
                    )}
                    {preview.duplicate.relatedData.contractHistories > 0 && (
                      <div>契約履歴: {preview.duplicate.relatedData.contractHistories}件</div>
                    )}
                    {preview.duplicate.relatedData.contactHistories > 0 && (
                      <div>接触履歴: {preview.duplicate.relatedData.contactHistories}件</div>
                    )}
                    {preview.duplicate.relatedData.contracts > 0 && (
                      <div>契約書: {preview.duplicate.relatedData.contracts}件</div>
                    )}
                    {preview.duplicate.relatedData.externalUsers > 0 && (
                      <div>外部ユーザー: {preview.duplicate.relatedData.externalUsers}件</div>
                    )}
                    {preview.duplicate.relatedData.registrationTokens > 0 && (
                      <div>登録トークン: {preview.duplicate.relatedData.registrationTokens}件</div>
                    )}
                    {preview.duplicate.relatedData.referredAgents > 0 && (
                      <div>紹介代理店: {preview.duplicate.relatedData.referredAgents}件</div>
                    )}
                    {preview.duplicate.relatedData.leadFormSubmissions > 0 && (
                      <div>リードフォーム回答: {preview.duplicate.relatedData.leadFormSubmissions}件</div>
                    )}
                    {totalDuplicateRecords === 0 && (
                      <div className="text-muted-foreground">移動する関連データはありません</div>
                    )}
                  </div>
                </div>

                {/* StpCompany衝突 */}
                {preview.stpCompanyConflicts.length > 0 && (
                  <div className="border border-amber-300 rounded-md p-4 bg-amber-50">
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      STP企業の衝突
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      両方の企業にSTP企業データが存在します。どちらを残すか選択してください。
                    </p>
                    <RadioGroup
                      value={stpCompanyResolution}
                      onValueChange={(v) =>
                        setStpCompanyResolution(v as "keep_a" | "keep_b" | "keep_both")
                      }
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_a" id="stp-keep-a" />
                        <Label htmlFor="stp-keep-a" className="text-sm">
                          統合先を残す
                          {preview.stpCompanyConflicts[0].survivorStageName && (
                            <Badge variant="outline" className="ml-2">
                              {preview.stpCompanyConflicts[0].survivorStageName}
                            </Badge>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_b" id="stp-keep-b" />
                        <Label htmlFor="stp-keep-b" className="text-sm">
                          統合元を残す
                          {preview.stpCompanyConflicts[0].duplicateStageName && (
                            <Badge variant="outline" className="ml-2">
                              {preview.stpCompanyConflicts[0].duplicateStageName}
                            </Badge>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_both" id="stp-keep-both" />
                        <Label htmlFor="stp-keep-both" className="text-sm text-amber-700">
                          両方残す（後日対応が必要）
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* StpAgent衝突 */}
                {preview.stpAgentConflicts.length > 0 && (
                  <div className="border border-amber-300 rounded-md p-4 bg-amber-50">
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      代理店の衝突
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      両方の企業に代理店データが存在します。どちらを残すか選択してください。
                    </p>
                    <RadioGroup
                      value={stpAgentResolution}
                      onValueChange={(v) =>
                        setStpAgentResolution(v as "keep_a" | "keep_b" | "keep_both")
                      }
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_a" id="agent-keep-a" />
                        <Label htmlFor="agent-keep-a" className="text-sm">
                          統合先を残す（{preview.stpAgentConflicts[0].survivorCategory}）
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_b" id="agent-keep-b" />
                        <Label htmlFor="agent-keep-b" className="text-sm">
                          統合元を残す（{preview.stpAgentConflicts[0].duplicateCategory}）
                        </Label>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="keep_both" id="agent-keep-both" />
                        <Label htmlFor="agent-keep-both" className="text-sm text-amber-700">
                          両方残す（後日対応が必要）
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* 基本情報の差分 */}
                {preview.fieldDiffs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">基本情報の差分</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      統合先の値が保持されます。統合元のみに値がある場合は手動で反映してください。
                    </p>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2">項目</th>
                            <th className="text-left p-2">統合先</th>
                            <th className="text-left p-2">統合元</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.fieldDiffs.map((diff) => (
                            <tr key={diff.field} className="border-t">
                              <td className="p-2 font-medium">{diff.label}</td>
                              <td className="p-2">{diff.survivorValue || <span className="text-muted-foreground">-</span>}</td>
                              <td className="p-2">{diff.duplicateValue || <span className="text-muted-foreground">-</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("select")}>
                  戻る
                </Button>
                <Button variant="destructive" onClick={handleConfirmStart}>
                  統合を実行
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 4: 結果 */}
          {step === "result" && (
            <>
              <DialogHeader>
                <DialogTitle>統合結果</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">統合処理中...</span>
                  </div>
                )}
                {!loading && resultMessage && (
                  <>
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        {resultMessage}
                      </AlertDescription>
                    </Alert>
                    {resultWarnings.map((warning, i) => (
                      <Alert key={i} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{warning}</AlertDescription>
                      </Alert>
                    ))}
                  </>
                )}
                {!loading && resultError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{resultError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleClose}>閉じる</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Step 3: 確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に統合しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{duplicateName}</strong> のデータを{" "}
              <strong>{companyName}</strong> に統合します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteMerge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              統合を実行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
