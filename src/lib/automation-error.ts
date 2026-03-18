import { prisma } from "@/lib/prisma";

/**
 * 自動化処理で発生したエラーをDBに記録する。
 *
 * この関数自体がエラーを投げないよう内部で try-catch している。
 * 呼び出し元の処理をブロックしない設計。
 */
export async function logAutomationError(input: {
  /** エラー発生元の識別子（例: "cloudsign-webhook", "cron/remind-slp-members"） */
  source: string;
  /** エラーメッセージ */
  message: string;
  /** 追加の詳細情報（JSON化できるオブジェクト） */
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.automationError.create({
      data: {
        source: input.source,
        message: input.message.substring(0, 2000),
        detail: input.detail ? JSON.stringify(input.detail) : null,
      },
    });
  } catch (err) {
    // DB書き込み自体が失敗した場合はコンソールにのみ出力
    console.error("[logAutomationError] Failed to save error:", err, input);
  }
}
