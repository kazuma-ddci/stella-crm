"use client";

import { useState, useRef, useCallback } from "react";
import {
  KoutekiPageShell,
  KoutekiCard,
  KoutekiCardContent,
  KoutekiButton,
  KoutekiInput,
  KoutekiTextarea,
  KoutekiCheckbox,
  KoutekiFormField,
  KoutekiFormStack,
} from "@/components/kouteki";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  X,
  FileText,
  Eye,
} from "lucide-react";

// ファイルアップロードの型
interface UploadedFile {
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

// フォームデータの型
interface FormData {
  name: string;
  lineName: string;
  email: string;
  santeiKisoFiles: UploadedFile[];
  hoshuGetsugakuFiles: UploadedFile[];
  shikakuShutokuFiles: UploadedFile[];
  gensenChoshuFiles: UploadedFile[];
  chinginDaichoFiles: UploadedFile[];
  shoyoFiles: UploadedFile[];
  note: string;
  privacyAgreed: boolean;
}

type PageStatus = "form" | "submitting" | "success" | "error";

// ファイルアップロードコンポーネント
function FileUploadArea({
  files,
  onFilesChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp",
}: {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
      }));
      onFilesChange([...files, ...newFiles]);
    },
    [files, onFilesChange]
  );

  const removeFile = (index: number) => {
    URL.revokeObjectURL(files[index].previewUrl);
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const openPreview = (f: UploadedFile) => {
    window.open(f.previewUrl, "_blank");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 bg-slate-50 hover:border-slate-300"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        <p className="text-sm text-slate-500">
          ファイルをここにドラッグ&ドロップでアップロード
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mx-auto flex items-center gap-1.5 text-sm text-slate-600 transition-colors hover:text-slate-800"
      >
        <span className="text-lg leading-none">+</span>
        ローカルファイルをアップロード
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      {/* アップロード済みファイル一覧 */}
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
              <button
                type="button"
                onClick={() => openPreview(f)}
                className="flex-1 truncate text-left text-sm text-blue-700 transition-colors hover:text-blue-900 hover:underline"
                title="クリックしてプレビュー"
              >
                {f.name}
              </button>
              <span className="flex-shrink-0 text-xs text-slate-400">
                {formatFileSize(f.size)}
              </span>
              <button
                type="button"
                onClick={() => openPreview(f)}
                className="flex-shrink-0 text-slate-400 transition-colors hover:text-blue-600"
                title="プレビュー"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="flex-shrink-0 text-slate-400 transition-colors hover:text-rose-500"
                title="削除"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 結果/エラー画面用の共通カード */
function StatusCard({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5 text-center">
      <div className="flex justify-center">
        <div
          className={`inline-flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}
        >
          {icon}
        </div>
      </div>
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      {children && (
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SlpHrEvaluationFormPage() {
  const [status, setStatus] = useState<PageStatus>("form");
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    lineName: "",
    email: "",
    santeiKisoFiles: [],
    hoshuGetsugakuFiles: [],
    shikakuShutokuFiles: [],
    gensenChoshuFiles: [],
    chinginDaichoFiles: [],
    shoyoFiles: [],
    note: "",
    privacyAgreed: false,
  });

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleFilesChange = (
    field: keyof FormData,
    files: UploadedFile[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: files }));
    if (errorMessage) setErrorMessage("");
  };

  const validate = (): string | null => {
    if (!formData.name.trim()) return "氏名を入力してください";
    if (!formData.lineName.trim()) return "LINE名を入力してください";
    if (!formData.email.trim()) return "メールアドレスを入力してください";
    if (formData.santeiKisoFiles.length === 0)
      return "算定基礎届をアップロードしてください";
    if (formData.gensenChoshuFiles.length === 0)
      return "源泉徴収簿をアップロードしてください";
    if (!formData.privacyAgreed)
      return "個人情報・機密情報の取扱いに同意してください";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validate();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setStatus("submitting");

    // TODO: 送信処理は後ほど実装
    // 現時点ではフォームUIのみ
    try {
      // 仮の送信完了表示
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus("success");
    } catch {
      setErrorMessage("送信に失敗しました");
      setStatus("error");
    }
  };

  // 送信成功
  if (status === "success") {
    return (
      <KoutekiPageShell
        title="人事評価制度再設計"
        subtitle="（必要書類提出フォーム）"
      >
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />}
          iconBg="bg-emerald-50"
          title="書類を提出いただきありがとうございます"
        >
          <p>
            ご提出いただいた書類およびご入力内容をもとに内容を確認し、
            <br />
            人事評価改善のご提案をさせていただきます。
          </p>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // エラー
  if (status === "error") {
    return (
      <KoutekiPageShell
        title="人事評価制度再設計"
        subtitle="（必要書類提出フォーム）"
      >
        <StatusCard
          icon={<AlertCircle className="h-8 w-8 text-rose-500" />}
          iconBg="bg-rose-50"
          title="送信に失敗しました"
        >
          <p>{errorMessage}</p>
          <div className="pt-2">
            <KoutekiButton onClick={() => setStatus("form")}>
              フォームに戻る
            </KoutekiButton>
          </div>
        </StatusCard>
      </KoutekiPageShell>
    );
  }

  // フォーム表示
  return (
    <KoutekiPageShell
      title="人事評価制度再設計"
      subtitle={
        <>
          本フォームは、人事評価改善に伴う制度設計および検討を行うために、
          必要書類をご提出いただくためのフォームです。
          <br />
          ご提出いただいた書類およびご入力内容をもとに内容を確認し、問題がないことを確認次第、人事評価改善のご提案をさせていただきます。
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <p className="mb-5 text-xs text-rose-500">* 必須の質問です</p>

        <KoutekiFormStack>
          {/* 氏名 */}
          <KoutekiFormField label="氏名(漢字及びフルネーム)" required htmlFor="name">
            <KoutekiInput
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="内容を入力"
            />
          </KoutekiFormField>

          {/* LINE名 */}
          <KoutekiFormField
            label="LINE名"
            required
            htmlFor="lineName"
            description="本名ではなく、LINEで登録しているお名前をご記載ください。"
          >
            <KoutekiInput
              id="lineName"
              value={formData.lineName}
              onChange={(e) => handleInputChange("lineName", e.target.value)}
              placeholder="内容を入力"
            />
          </KoutekiFormField>

          {/* メールアドレス */}
          <KoutekiFormField label="メールアドレス" required htmlFor="email">
            <KoutekiInput
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="内容を入力"
            />
          </KoutekiFormField>

          {/* 算定基礎届 */}
          <KoutekiFormField
            label="算定基礎届"
            required
            description={
              <>
                原則として、直近から最大過去5年間分の算定基礎届をご提出ください。
                <br />
                取得可能な範囲で問題ありません。
              </>
            }
          >
            <FileUploadArea
              files={formData.santeiKisoFiles}
              onFilesChange={(files) =>
                handleFilesChange("santeiKisoFiles", files)
              }
            />
          </KoutekiFormField>

          {/* 被保険者報酬月額変更届 */}
          <KoutekiFormField
            label="被保険者報酬月額変更届"
            description={
              <>
                報酬変更・随時改定等に関する変更届について、
                <br />
                直近から最大過去5年分をご提出ください。
              </>
            }
          >
            <FileUploadArea
              files={formData.hoshuGetsugakuFiles}
              onFilesChange={(files) =>
                handleFilesChange("hoshuGetsugakuFiles", files)
              }
            />
          </KoutekiFormField>

          {/* 被保険者資格取得届 */}
          <KoutekiFormField
            label="被保険者資格取得届"
            description={
              <>
                対象期間（最大過去5年間）に在籍していた従業員分の
                <br />
                被保険者資格取得届をご提出ください。
              </>
            }
          >
            <FileUploadArea
              files={formData.shikakuShutokuFiles}
              onFilesChange={(files) =>
                handleFilesChange("shikakuShutokuFiles", files)
              }
            />
          </KoutekiFormField>

          {/* 源泉徴収簿 */}
          <KoutekiFormField
            label="源泉徴収簿"
            required
            description={
              <>
                最大過去5年間分について、
                <br />
                源泉徴収簿をご提出ください。
              </>
            }
          >
            <FileUploadArea
              files={formData.gensenChoshuFiles}
              onFilesChange={(files) =>
                handleFilesChange("gensenChoshuFiles", files)
              }
            />
          </KoutekiFormField>

          {/* 賃金台帳 */}
          <KoutekiFormField
            label="賃金台帳"
            description={
              <>
                最大過去5年間分について、
                <br />
                賃金台帳をご提出ください。
              </>
            }
          >
            <FileUploadArea
              files={formData.chinginDaichoFiles}
              onFilesChange={(files) =>
                handleFilesChange("chinginDaichoFiles", files)
              }
            />
          </KoutekiFormField>

          {/* 賞与関連資料 */}
          <KoutekiFormField
            label="賞与関連資料（該当がある場合）"
            description={
              <>
                賞与支給がある場合のみ、
                <br />
                最大過去5年間分の賞与関連資料をご提出ください。
                <br />
                （例：賞与支給明細、賞与台帳 等）
              </>
            }
          >
            <FileUploadArea
              files={formData.shoyoFiles}
              onFilesChange={(files) => handleFilesChange("shoyoFiles", files)}
            />
          </KoutekiFormField>

          {/* 補足事項 */}
          <KoutekiFormField
            label="補足事項"
            htmlFor="note"
            description={
              <>
                書類内容に関する補足や、事前に共有しておきたい事項があればご記載ください。
                <br />
                記載例：
                <br />
                ・特殊な雇用形態がある
                <br />
                ・途中入社・途中退職者が多い
                <br />
                ・社労士が関与している
                <br />
                ・一部年度の書類が未取得 など
              </>
            }
          >
            <KoutekiTextarea
              id="note"
              value={formData.note}
              onChange={(e) => handleInputChange("note", e.target.value)}
              placeholder="内容を入力"
              rows={4}
            />
          </KoutekiFormField>

          {/* 個人情報・機密情報の取扱い同意 */}
          <KoutekiCard variant="ghost">
            <KoutekiCardContent className="space-y-3 px-5 py-5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  個人情報・機密情報の取扱い同意
                </span>
                <span className="inline-flex h-5 items-center justify-center rounded-md bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-600">
                  必須
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                機密情報および個人情報の取扱いに関する同意書を確認し、同意します。
              </p>
              <a
                href="https://drive.google.com/file/d/1jI-cUueB5QX5ROLnMgIDtNkIUe94s_7G/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                同意書を確認する（Google Drive）
              </a>
              <div className="pt-1">
                <KoutekiCheckbox
                  checked={formData.privacyAgreed}
                  onChange={(e) =>
                    handleInputChange("privacyAgreed", e.target.checked)
                  }
                >
                  同意する
                </KoutekiCheckbox>
              </div>
            </KoutekiCardContent>
          </KoutekiCard>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 送信ボタン */}
          <KoutekiButton
            type="submit"
            size="lg"
            className="w-full"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                送信中...
              </>
            ) : (
              "送信"
            )}
          </KoutekiButton>
        </KoutekiFormStack>
      </form>
    </KoutekiPageShell>
  );
}
