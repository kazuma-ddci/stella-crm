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
import { Plus, Trash2, Loader2, FileText, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getLinkedTemplates,
  addTemplateLink,
  removeTemplateLink,
  updateTemplate,
} from "./actions";

type OtherContractType = {
  name: string;
  projectName: string;
};

type LinkedTemplate = {
  linkId: number;
  templateId: number;
  cloudsignTemplateId: string;
  name: string;
  description: string | null;
  operatingCompanyName: string;
  otherContractTypes: OtherContractType[];
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

  // 編集中のテンプレート
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
      setEditingTemplateId(null);
    }
  }, [open, loadTemplates]);

  const handleStartEdit = (t: LinkedTemplate) => {
    setEditingTemplateId(t.templateId);
    setEditName(t.name);
    setEditDescription(t.description ?? "");
  };

  const handleCancelEdit = () => {
    setEditingTemplateId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleSaveEdit = async (templateId: number) => {
    if (!editName.trim()) {
      toast.error("テンプレート名を入力してください");
      return;
    }
    setEditSaving(true);
    try {
      await updateTemplate(templateId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });
      toast.success("テンプレートを更新しました");
      handleCancelEdit();
      await loadTemplates();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "更新に失敗しました"
      );
    } finally {
      setEditSaving(false);
    }
  };

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
                  {templates.map((t) => {
                    const isEditing = editingTemplateId === t.templateId;
                    const isShared = t.otherContractTypes.length > 0;

                    return (
                      <div
                        key={t.linkId}
                        className="border rounded-lg p-3"
                      >
                        {isEditing ? (
                          // 編集モード
                          <div className="space-y-3">
                            {isShared && (
                              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-800">
                                  <p className="font-medium">
                                    このテンプレートは他の契約種別でも使われています
                                  </p>
                                  <p className="mt-1">
                                    編集するとこちらにも反映されます:
                                  </p>
                                  <ul className="list-disc list-inside mt-1">
                                    {t.otherContractTypes.map((oct, idx) => (
                                      <li key={idx}>
                                        {oct.projectName} / {oct.name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">
                                テンプレート名 <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={editSaving}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">説明（任意）</Label>
                              <Input
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                disabled={editSaving}
                              />
                            </div>
                            <p className="text-xs text-gray-400 font-mono">
                              CloudSignテンプレートID: {t.cloudsignTemplateId}（編集不可）
                            </p>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEdit}
                                disabled={editSaving}
                              >
                                キャンセル
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(t.templateId)}
                                disabled={editSaving}
                              >
                                {editSaving ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    保存中
                                  </>
                                ) : (
                                  "保存"
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 表示モード
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 min-w-0">
                              <FileText className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{t.name}</p>
                                  {isShared && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
                                      title={`他の契約種別でも使用中: ${t.otherContractTypes.map((c) => `${c.projectName}/${c.name}`).join(", ")}`}
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      共有中
                                    </span>
                                  )}
                                </div>
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
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEdit(t)}
                                  title="編集"
                                >
                                  <Pencil className="h-4 w-4 text-gray-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemove(t.linkId, t.name)}
                                  title="紐づけ解除"
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
