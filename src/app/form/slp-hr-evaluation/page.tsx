"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
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
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-sky-400 bg-sky-50"
            : "border-gray-200 bg-gray-50 hover:border-gray-300"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          ファイルをここにドラッグ&ドロップでアップロード
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors mx-auto"
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
        <div className="space-y-1.5 mt-2">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
            >
              <FileText className="h-4 w-4 text-sky-500 flex-shrink-0" />
              <button
                type="button"
                onClick={() => openPreview(f)}
                className="text-sm text-sky-600 hover:text-sky-800 hover:underline truncate flex-1 text-left transition-colors"
                title="クリックしてプレビュー"
              >
                {f.name}
              </button>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatFileSize(f.size)}
              </span>
              <button
                type="button"
                onClick={() => openPreview(f)}
                className="text-gray-400 hover:text-sky-600 transition-colors flex-shrink-0"
                title="プレビュー"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
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

// ヘッダー
function Header() {
  return (
    <div className="bg-gradient-to-r from-sky-500 to-emerald-400 rounded-t-2xl p-8 text-center">
      <h1 className="text-2xl font-bold text-white tracking-wide">
        人事評価制度再設計
      </h1>
      <p className="text-sky-100 text-sm mt-1">(必要書類提出フォーム)</p>
      <p className="text-sky-100 text-sm mt-2">
        一般社団法人 公的制度教育推進協会
      </p>
    </div>
  );
}

// フッター
function Footer() {
  return (
    <p className="text-center text-xs text-gray-400 mt-6">
      &copy; 一般社団法人 公的制度教育推進協会
    </p>
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
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              書類を提出いただきありがとうございます
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              ご提出いただいた書類およびご入力内容をもとに内容を確認し、
              <br />
              人事評価改善のご提案をさせていただきます。
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // エラー
  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Header />
          <div className="bg-white rounded-b-2xl shadow-lg p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              送信に失敗しました
            </h2>
            <p className="text-gray-600 text-sm mb-4">{errorMessage}</p>
            <Button
              onClick={() => setStatus("form")}
              className="bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 text-white rounded-xl"
            >
              フォームに戻る
            </Button>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // フォーム表示
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Header />

        <div className="bg-white rounded-b-2xl shadow-lg">
          <div className="px-8 pt-8 pb-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              本フォームは、人事評価改善に伴う制度設計および検討を行うために、
              <br />
              必要書類をご提出いただくためのフォームです。
              <br />
              ご提出いただいた書類およびご入力内容をもとに内容を確認し、
              <br />
              問題がないことを確認次第、人事評価改善のご提案をさせていただきます。
            </p>
            <p className="text-red-500 text-xs mt-3">* 必須の質問です</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
            {/* 氏名 */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-800">
                氏名(漢字及びフルネーム) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="内容を入力"
              />
            </div>

            {/* LINE名 */}
            <div className="space-y-2">
              <Label htmlFor="lineName" className="text-sm font-semibold text-gray-800">
                LINE名 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500">
                本名ではなく、LINEで登録しているお名前をご記載ください。
              </p>
              <Input
                id="lineName"
                value={formData.lineName}
                onChange={(e) => handleInputChange("lineName", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="内容を入力"
              />
            </div>

            {/* メールアドレス */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-800">
                メールアドレス <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500"
                placeholder="内容を入力"
              />
            </div>

            {/* 算定基礎届 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                算定基礎届 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                原則として、直近から最大過去5年間分の算定基礎届をご提出ください。
                <br />
                取得可能な範囲で問題ありません。
              </p>
              <FileUploadArea
                files={formData.santeiKisoFiles}
                onFilesChange={(files) =>
                  handleFilesChange("santeiKisoFiles", files)
                }
              />
            </div>

            {/* 被保険者報酬月額変更届 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                被保険者報酬月額変更届
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                報酬変更・随時改定等に関する変更届について、
                <br />
                直近から最大過去5年分をご提出ください。
              </p>
              <FileUploadArea
                files={formData.hoshuGetsugakuFiles}
                onFilesChange={(files) =>
                  handleFilesChange("hoshuGetsugakuFiles", files)
                }
              />
            </div>

            {/* 被保険者資格取得届 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                被保険者資格取得届
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                対象期間（最大過去5年間）に在籍していた従業員分の
                <br />
                被保険者資格取得届をご提出ください。
              </p>
              <FileUploadArea
                files={formData.shikakuShutokuFiles}
                onFilesChange={(files) =>
                  handleFilesChange("shikakuShutokuFiles", files)
                }
              />
            </div>

            {/* 源泉徴収簿 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                源泉徴収簿 <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                最大過去5年間分について、
                <br />
                源泉徴収簿をご提出ください。
              </p>
              <FileUploadArea
                files={formData.gensenChoshuFiles}
                onFilesChange={(files) =>
                  handleFilesChange("gensenChoshuFiles", files)
                }
              />
            </div>

            {/* 賃金台帳 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                賃金台帳
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                最大過去5年間分について、
                <br />
                賃金台帳をご提出ください。
              </p>
              <FileUploadArea
                files={formData.chinginDaichoFiles}
                onFilesChange={(files) =>
                  handleFilesChange("chinginDaichoFiles", files)
                }
              />
            </div>

            {/* 賞与関連資料 */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-800">
                賞与関連資料（該当がある場合）
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
                賞与支給がある場合のみ、
                <br />
                最大過去5年間分の賞与関連資料をご提出ください。
                <br />
                （例：賞与支給明細、賞与台帳 等）
              </p>
              <FileUploadArea
                files={formData.shoyoFiles}
                onFilesChange={(files) =>
                  handleFilesChange("shoyoFiles", files)
                }
              />
            </div>

            {/* 補足事項 */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-sm font-semibold text-gray-800">
                補足事項
              </Label>
              <p className="text-xs text-gray-500 leading-relaxed">
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
              </p>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => handleInputChange("note", e.target.value)}
                className="border-gray-300 focus:border-sky-500 focus:ring-sky-500 min-h-[80px]"
                placeholder="内容を入力"
              />
            </div>

            {/* 個人情報・機密情報の取扱い同意 */}
            <div className="space-y-3 bg-gray-50 rounded-xl p-5">
              <Label className="text-sm font-semibold text-gray-800">
                個人情報・機密情報の取扱い同意{" "}
                <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-gray-600 leading-relaxed">
                機密情報および個人情報の取扱いに関する同意書を確認し、同意します。
              </p>
              <a
                href="https://drive.google.com/file/d/1jI-cUueB5QX5ROLnMgIDtNkIUe94s_7G/view?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sky-600 hover:text-sky-700 text-xs underline underline-offset-2"
              >
                同意書を確認する（Google Drive）
              </a>
              <label className="flex items-center gap-3 cursor-pointer mt-2">
                <Checkbox
                  checked={formData.privacyAgreed}
                  onCheckedChange={(checked) =>
                    handleInputChange("privacyAgreed", checked === true)
                  }
                  className="data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                />
                <span className="text-sm text-gray-700">同意する</span>
              </label>
            </div>

            {/* エラーメッセージ */}
            {errorMessage && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 送信ボタン */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-sky-500 to-emerald-400 hover:from-sky-600 hover:to-emerald-500 text-white rounded-xl shadow-md transition-all duration-200"
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
            </Button>
          </form>
        </div>

        <Footer />
      </div>
    </div>
  );
}
