"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  MessageSquare,
  Reply,
  Paperclip,
  FileText,
  X,
  Upload,
  ArrowLeftRight,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { createComment, getComments } from "./actions";
import type { CommentWithReplies } from "./actions";

// ============================================
// 定数
// ============================================

const COMMENT_TYPE_LABELS: Record<string, string> = {
  normal: "通常",
  return: "差し戻し",
  approval: "承認",
  question: "質問",
};

const COMMENT_TYPE_ICONS: Record<string, typeof MessageSquare> = {
  normal: MessageSquare,
  return: ArrowLeftRight,
  approval: CheckCircle2,
  question: HelpCircle,
};

const COMMENT_TYPE_COLORS: Record<string, string> = {
  normal: "bg-gray-100 text-gray-700",
  return: "bg-red-100 text-red-700",
  approval: "bg-green-100 text-green-700",
  question: "bg-blue-100 text-blue-700",
};

const RETURN_REASON_LABELS: Record<string, string> = {
  question: "質問",
  correction_request: "修正依頼",
  approval_check: "承認確認",
  other: "その他",
};

// ============================================
// Props
// ============================================

type CommentSectionProps = {
  transactionId?: number;
  invoiceGroupId?: number;
  paymentGroupId?: number;
  /** コメント種別の選択を許可するか（差し戻し・承認等）*/
  allowCommentTypes?: boolean;
};

// ============================================
// ファイルアップロード用の型
// ============================================

type FileInfo = {
  filePath: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
};

// ============================================
// CommentSection コンポーネント
// ============================================

export function CommentSection({
  transactionId,
  invoiceGroupId,
  paymentGroupId,
  allowCommentTypes = false,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  const loadComments = useCallback(async () => {
    setLoadError(null);
    const result = await getComments({
      transactionId,
      invoiceGroupId,
      paymentGroupId,
    });
    if (result.ok) {
      setComments(result.data);
    } else {
      setComments([]);
      setLoadError(result.message);
    }
    setLoading(false);
  }, [transactionId, invoiceGroupId, paymentGroupId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleCommentCreated = () => {
    setReplyTo(null);
    loadComments();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">
          コメント{comments.length > 0 && ` (${comments.length})`}
        </h3>
      </div>

      {/* コメント投稿フォーム */}
      <CommentForm
        transactionId={transactionId}
        invoiceGroupId={invoiceGroupId}
        paymentGroupId={paymentGroupId}
        parentId={replyTo ?? undefined}
        allowCommentTypes={allowCommentTypes}
        onCreated={handleCommentCreated}
        onCancelReply={replyTo !== null ? () => setReplyTo(null) : undefined}
      />

      {/* コメント一覧 */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-amber-600 text-center py-4">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          コメントはまだありません
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={setReplyTo}
              activeReplyId={replyTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CommentForm コンポーネント
// ============================================

function CommentForm({
  transactionId,
  invoiceGroupId,
  paymentGroupId,
  parentId,
  allowCommentTypes,
  onCreated,
  onCancelReply,
}: {
  transactionId?: number;
  invoiceGroupId?: number;
  paymentGroupId?: number;
  parentId?: number;
  allowCommentTypes: boolean;
  onCreated: () => void;
  onCancelReply?: () => void;
}) {
  const [body, setBody] = useState("");
  const [commentType, setCommentType] = useState("normal");
  const [returnReasonType, setReturnReasonType] = useState("");
  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const res = await fetch("/api/comments/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "アップロードに失敗しました");
      }

      const data = await res.json();
      setAttachments((prev) => [...prev, ...data.files]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      // input をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const result = await createComment({
        transactionId,
        invoiceGroupId,
        paymentGroupId,
        parentId,
        body,
        commentType,
        returnReasonType: commentType === "return" ? returnReasonType : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // リセット
      setBody("");
      setCommentType("normal");
      setReturnReasonType("");
      setAttachments([]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "コメントの投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const isReturnType = commentType === "return";
  const canSubmit =
    body.trim().length > 0 &&
    !submitting &&
    !uploading &&
    (!isReturnType || returnReasonType !== "");

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {/* 返信先表示 */}
      {parentId && onCancelReply && (
        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded px-2 py-1">
          <Reply className="h-3 w-3" />
          <span>返信モード</span>
          <button
            onClick={onCancelReply}
            className="ml-auto text-blue-400 hover:text-blue-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* コメント種別（allowCommentTypes かつトップレベルのみ） */}
      {allowCommentTypes && !parentId && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">種別</Label>
          <Select value={commentType} onValueChange={setCommentType}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(COMMENT_TYPE_LABELS)
                .filter(([value]) => {
                  // 取引コメントでは「差し戻し」を除外（returnTransaction経由に限定）
                  if (value === "return" && transactionId) return false;
                  return true;
                })
                .map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 差し戻し理由 */}
      {isReturnType && !parentId && (
        <div className="flex items-center gap-2">
          <Label className="text-xs">差し戻し理由 *</Label>
          <Select value={returnReasonType} onValueChange={setReturnReasonType}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="理由を選択" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RETURN_REASON_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* テキストエリア */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "返信を入力..." : "コメントを入力..."}
        rows={2}
        className="text-sm resize-none"
      />

      {/* 添付ファイル一覧 */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-muted-foreground bg-gray-50 rounded px-2 py-1"
            >
              <FileText className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{att.fileName}</span>
              {att.fileSize && (
                <span className="text-gray-400 flex-shrink-0">
                  ({formatFileSize(att.fileSize)})
                </span>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="ml-auto text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* エラー表示 */}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* 操作ボタン */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
          onChange={handleFileUpload}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || submitting}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </Button>

        <div className="ml-auto">
          <Button
            size="sm"
            className="h-8"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {parentId ? "返信" : "投稿"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CommentThread コンポーネント
// ============================================

function CommentThread({
  comment,
  onReply,
  activeReplyId,
  depth = 0,
}: {
  comment: CommentWithReplies;
  onReply: (id: number) => void;
  activeReplyId: number | null;
  depth?: number;
}) {
  const Icon = COMMENT_TYPE_ICONS[comment.commentType] || MessageSquare;
  const colorClass = COMMENT_TYPE_COLORS[comment.commentType] || COMMENT_TYPE_COLORS.normal;
  const isReturn = comment.commentType === "return";

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-gray-100 pl-3" : ""}>
      <div
        className={`rounded-lg p-3 ${
          isReturn ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{comment.creator.name}</span>
          <span
            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${colorClass}`}
          >
            <Icon className="h-3 w-3" />
            {COMMENT_TYPE_LABELS[comment.commentType] ?? comment.commentType}
          </span>
          {isReturn && comment.returnReasonType && (
            <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3 inline mr-0.5" />
              {RETURN_REASON_LABELS[comment.returnReasonType] ??
                comment.returnReasonType}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDate(comment.createdAt)}
          </span>
        </div>

        {/* 本文 */}
        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>

        {/* 添付ファイル */}
        {comment.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {comment.attachments.map((att) => (
              <a
                key={att.id}
                href={att.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                <Upload className="h-3 w-3" />
                {att.fileName}
                {att.fileSize && (
                  <span className="text-gray-400">
                    ({formatFileSize(att.fileSize)})
                  </span>
                )}
              </a>
            ))}
          </div>
        )}

        {/* 返信ボタン（3階層目以降は非表示：getCommentsのネスト上限） */}
        {depth < 2 && (
          <div className="mt-2">
            <button
              onClick={() => onReply(comment.id)}
              className={`text-xs flex items-center gap-1 ${
                activeReplyId === comment.id
                  ? "text-blue-600 font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Reply className="h-3 w-3" />
              返信
            </button>
          </div>
        )}
      </div>

      {/* 返信スレッド */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              onReply={onReply}
              activeReplyId={activeReplyId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ユーティリティ
// ============================================

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
