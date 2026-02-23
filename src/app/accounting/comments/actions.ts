"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

function validateEntityRef(input: CreateCommentInput) {
  const refs = [
    input.transactionId,
    input.invoiceGroupId,
    input.paymentGroupId,
  ].filter((v) => v !== undefined && v !== null);

  if (refs.length === 0) {
    throw new Error(
      "取引、請求グループ、支払グループのいずれかを指定してください"
    );
  }
  if (refs.length > 1) {
    throw new Error(
      "取引、請求グループ、支払グループは1つのみ指定できます"
    );
  }
}

// ============================================
// 1. createComment
// ============================================

export async function createComment(input: CreateCommentInput) {
  const session = await getSession();
  const staffId = session.id;

  // バリデーション
  if (!input.body?.trim()) {
    throw new Error("コメント本文は必須です");
  }

  validateEntityRef(input);

  const commentType = input.commentType || "normal";
  if (!(VALID_COMMENT_TYPES as readonly string[]).includes(commentType)) {
    throw new Error("コメント種別が不正です");
  }

  if (commentType === "return") {
    if (
      !input.returnReasonType ||
      !(VALID_RETURN_REASONS as readonly string[]).includes(
        input.returnReasonType
      )
    ) {
      throw new Error("差し戻し理由の種別を選択してください");
    }
  }

  // 親コメントの存在チェック
  if (input.parentId) {
    const parent = await prisma.transactionComment.findFirst({
      where: { id: input.parentId, deletedAt: null },
      select: { id: true, transactionId: true, invoiceGroupId: true, paymentGroupId: true },
    });
    if (!parent) {
      throw new Error("返信先のコメントが見つかりません");
    }
    // 親コメントと同じエンティティに紐づいているか確認
    if (
      (input.transactionId && parent.transactionId !== input.transactionId) ||
      (input.invoiceGroupId && parent.invoiceGroupId !== input.invoiceGroupId) ||
      (input.paymentGroupId && parent.paymentGroupId !== input.paymentGroupId)
    ) {
      throw new Error("返信先のコメントが対象と一致しません");
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

  return { id: result.id };
}

// ============================================
// 2. getComments
// ============================================

export async function getComments(params: {
  transactionId?: number;
  invoiceGroupId?: number;
  paymentGroupId?: number;
}): Promise<CommentWithReplies[]> {
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
    include: {
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
      replies: {
        where: { deletedAt: null },
        include: {
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
          replies: {
            where: { deletedAt: null },
            include: {
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
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return comments as unknown as CommentWithReplies[];
}
