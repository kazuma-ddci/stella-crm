"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type CommentWithReplies = {
  id: number;
  body: string;
  commentType: string;
  returnReasonType: string | null;
  parentId: number | null;
  createdAt: Date;
  creator: { id: number; name: string };
  attachments: {
    id: number;
    fileName: string;
    filePath: string;
    fileSize: number | null;
    mimeType: string | null;
  }[];
  replies: CommentWithReplies[];
};

type CreateCommentInput = {
  transactionId?: number;
  invoiceGroupId?: number;
  paymentGroupId?: number;
  parentId?: number;
  body: string;
  commentType?: string;
  returnReasonType?: string;
  attachments?: {
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
  }[];
};

// ============================================
// バリデーション
// ============================================

const VALID_COMMENT_TYPES = ["normal", "return", "approval", "question"] as const;
const VALID_RETURN_REASONS = [
  "question",
  "correction_request",
  "approval_check",
  "other",
] as const;

function validateEntityRef(input: CreateCommentInput): string | null {
  const refs = [
    input.transactionId,
    input.invoiceGroupId,
    input.paymentGroupId,
  ].filter((v) => v !== undefined && v !== null);

  if (refs.length === 0) {
    return "取引、請求、支払のいずれかを指定してください";
  }
  if (refs.length > 1) {
    return "取引、請求、支払は1つのみ指定できます";
  }
  return null;
}

// ============================================
// 1. createComment
// ============================================

export async function createComment(
  input: CreateCommentInput
): Promise<ActionResult<{ id: number }>> {
  try {
  const session = await getSession();
  const staffId = session.id;

  // バリデーション
  if (!input.body?.trim()) {
    return err("コメント本文は必須です");
  }

  const entityErr = validateEntityRef(input);
  if (entityErr) return err(entityErr);

  const commentType = input.commentType || "normal";
  if (!(VALID_COMMENT_TYPES as readonly string[]).includes(commentType)) {
    return err("コメント種別が不正です");
  }

  // 差し戻しはreturnTransaction経由に限定（transactionIdへの直接差し戻しを禁止）
  if (commentType === "return" && input.transactionId) {
    return err(
      "取引の差し戻しはコメント欄からではなく、差し戻し機能をご利用ください"
    );
  }

  if (commentType === "return") {
    if (
      !input.returnReasonType ||
      !(VALID_RETURN_REASONS as readonly string[]).includes(
        input.returnReasonType
      )
    ) {
      return err("差し戻し理由の種別を選択してください");
    }
  }

  // 親コメントの存在チェック
  if (input.parentId) {
    const parent = await prisma.transactionComment.findFirst({
      where: { id: input.parentId, deletedAt: null },
      select: { id: true, transactionId: true, invoiceGroupId: true, paymentGroupId: true },
    });
    if (!parent) {
      return err("返信先のコメントが見つかりません");
    }
    // 親コメントと同じエンティティに紐づいているか確認
    if (
      (input.transactionId && parent.transactionId !== input.transactionId) ||
      (input.invoiceGroupId && parent.invoiceGroupId !== input.invoiceGroupId) ||
      (input.paymentGroupId && parent.paymentGroupId !== input.paymentGroupId)
    ) {
      return err("返信先のコメントが対象と一致しません");
    }
  }

  const attachments = input.attachments || [];

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.transactionComment.create({
      data: {
        transactionId: input.transactionId ?? null,
        invoiceGroupId: input.invoiceGroupId ?? null,
        paymentGroupId: input.paymentGroupId ?? null,
        parentId: input.parentId ?? null,
        body: input.body.trim(),
        commentType,
        returnReasonType:
          commentType === "return" ? input.returnReasonType! : null,
        createdBy: staffId,
      },
    });

    // 添付ファイル作成
    if (attachments.length > 0) {
      await tx.attachment.createMany({
        data: attachments.map((att) => ({
          commentId: comment.id,
          filePath: att.filePath,
          fileName: att.fileName,
          fileSize: att.fileSize ?? null,
          mimeType: att.mimeType ?? null,
          attachmentType: "other" as const,
          uploadedBy: staffId,
        })),
      });
    }

    return comment;
  });

  // キャッシュ無効化
  revalidatePath("/accounting/transactions");
  revalidatePath("/stp/finance/invoices");
  revalidatePath("/stp/finance/payment-groups");

  return ok({ id: result.id });
  } catch (e) {
    console.error("[createComment] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// ============================================
// 2. getComments
// ============================================

// コメント取得用 include 定義（各レベル共通）
const commentBaseInclude = {
  creator: { select: { id: true, name: true } },
  attachments: {
    where: { deletedAt: null },
    select: {
      id: true,
      fileName: true,
      filePath: true,
      fileSize: true,
      mimeType: true,
    },
  },
} satisfies Prisma.TransactionCommentInclude;

// 3階層ネストの include
const commentThreadInclude = {
  ...commentBaseInclude,
  replies: {
    where: { deletedAt: null },
    include: {
      ...commentBaseInclude,
      replies: {
        where: { deletedAt: null },
        include: commentBaseInclude,
        orderBy: { createdAt: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.TransactionCommentInclude;

// Prisma ペイロード型
type CommentBase = Prisma.TransactionCommentGetPayload<{
  include: typeof commentBaseInclude;
}>;

// 共通フィールドの抽出
function pickCommentFields(c: CommentBase): Omit<CommentWithReplies, "replies"> {
  return {
    id: c.id,
    body: c.body,
    commentType: c.commentType,
    returnReasonType: c.returnReasonType,
    parentId: c.parentId,
    createdAt: c.createdAt,
    creator: c.creator,
    attachments: c.attachments,
  };
}

export async function getComments(params: {
  transactionId?: number;
  invoiceGroupId?: number;
  paymentGroupId?: number;
}): Promise<CommentWithReplies[]> {
  // 認証: 経理プロジェクトの閲覧権限以上
  await requireStaffWithProjectPermission([
    { project: "accounting", level: "view" },
  ]);

  const where: Record<string, unknown> = {
    deletedAt: null,
    parentId: null, // トップレベルのみ取得
  };

  if (params.transactionId) {
    where.transactionId = params.transactionId;
  } else if (params.invoiceGroupId) {
    where.invoiceGroupId = params.invoiceGroupId;
  } else if (params.paymentGroupId) {
    where.paymentGroupId = params.paymentGroupId;
  } else {
    return [];
  }

  const comments = await prisma.transactionComment.findMany({
    where,
    include: commentThreadInclude,
    orderBy: { createdAt: "desc" },
  });

  // 型安全なマッピング（3階層目の replies を空配列で補完）
  return comments.map((c) => ({
    ...pickCommentFields(c),
    replies: c.replies.map((r1) => ({
      ...pickCommentFields(r1),
      replies: r1.replies.map((r2) => ({
        ...pickCommentFields(r2),
        replies: [],
      })),
    })),
  }));
}
