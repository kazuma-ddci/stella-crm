"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  getLinkedTemplates,
  addTemplateLink,
  removeTemplateLink,
} from "./actions";

type LinkedTemplate = {
  linkId: number;
  templateId: number;
  cloudsignTemplateId: string;
  name: string;
  description: string | null;
  operatingCompanyName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractTypeId: number;
  contractTypeName: string;
  canEdit: boolean;
};

export function TemplateLinkModal({
  open,
  onOpenChange,
  contractTypeId,
  contractTypeName,
  canEdit,
}: Props) {
  const [templates, setTemplates] = useState<LinkedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // 新規追加フォーム
  const [newCloudsignId, setNewCloudsignId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLinkedTemplates(contractTypeId);
      setTemplates(data);
    } catch (error) {
      console.error(error);
      toast.error("テンプレート情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [contractTypeId]);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setIsAdding(false);
      setNewCloudsignId("");
      setNewName("");
      setNewDescription("");
    }
  }, [open, loadTemplates]);

  const handleAdd = async () => {
    if (!newCloudsignId.trim()) {
      toast.error("テンプレートIDを入力してください");
      return;
    }
    if (!newName.trim()) {
      toast.error("テンプレート名を入力してください");
      return;
    }

    try {
      await addTemplateLink(contractTypeId, {
        cloudsignTemplateId: newCloudsignId.trim(),
        name: newName.trim(),
        description: newDescription.trim() || null,
      });
      toast.success("テンプレートを追加しました");
      setNewCloudsignId("");
      setNewName("");
      setNewDescription("");
      setIsAdding(false);
      await loadTemplates();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "追加に失敗しました"
      );
    }
  };

  const handleRemove = async (linkId: number, templateName: string) => {
    if (!confirm(`テンプレート「${templateName}」の紐づけを解除しますか？`)) return;

    try {
      await removeTemplateLink(linkId);
      toast.success("紐づけを解除しました");
      await loadTemplates();
    } catch (error) {
      console.error(error);
      toast.error("解除に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" className="p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle>
            テンプレート管理 - {contractTypeName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              読み込み中...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 紐づけ済みテンプレート一覧 */}
              {templates.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm">
                  テンプレートが紐づいていません
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.linkId}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-gray-500 font-mono truncate">
                            ID: {t.cloudsignTemplateId}
                          </p>
                          {t.description && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {t.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            運営法人: {t.operatingCompanyName}
                          </p>
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(t.linkId, t.name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 追加フォーム */}
              {canEdit && !isAdding && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  テンプレートを追加
                </Button>
              )}

              {canEdit && isAdding && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <h4 className="text-sm font-medium">テンプレートを追加</h4>
                  <div>
                    <Label className="text-xs">
                      クラウドサインテンプレートID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={newCloudsignId}
                      onChange={(e) => setNewCloudsignId(e.target.value)}
                      placeholder="例: abc-def-ghi-123"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      クラウドサインの管理画面からコピーしてください
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">
                      テンプレート名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="例: 業務委託基本契約書"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">説明（任意）</Label>
                    <Input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="例: STP向け標準契約"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAdding(false);
                        setNewCloudsignId("");
                        setNewName("");
                        setNewDescription("");
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button size="sm" onClick={handleAdd}>
                      追加
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
