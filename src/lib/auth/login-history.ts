import { prisma } from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * ログイン履歴を記録
 */
export async function recordLoginAttempt(
  externalUserId: number,
  result: "success" | "failure",
  ipAddress?: string | null,
  userAgent?: string | null,
  failureReason?: string
): Promise<void> {
  await prisma.loginHistory.create({
    data: {
      externalUserId,
      result,
      ipAddress,
      userAgent,
      failureReason,
    },
  });
}

/**
 * アカウントがロックされているか確認
 */
export async function isAccountLocked(
  externalUserId: number
): Promise<boolean> {
  const lockoutThreshold = new Date();
  lockoutThreshold.setMinutes(
    lockoutThreshold.getMinutes() - LOCKOUT_DURATION_MINUTES
  );

  // 直近のロックアウト期間内の失敗回数をカウント
  const failedAttempts = await prisma.loginHistory.count({
    where: {
      externalUserId,
      result: "failure",
      loginAt: {
        gte: lockoutThreshold,
      },
    },
  });

  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

/**
 * 最近のログイン履歴を取得
 */
export async function getRecentLoginHistory(
  externalUserId: number,
  limit: number = 10
) {
  return prisma.loginHistory.findMany({
    where: { externalUserId },
    orderBy: { loginAt: "desc" },
    take: limit,
  });
}

/**
 * 失敗したログイン試行回数を取得（ロックアウト期間内）
 */
export async function getFailedAttemptCount(
  externalUserId: number
): Promise<number> {
  const lockoutThreshold = new Date();
  lockoutThreshold.setMinutes(
    lockoutThreshold.getMinutes() - LOCKOUT_DURATION_MINUTES
  );

  return prisma.loginHistory.count({
    where: {
      externalUserId,
      result: "failure",
      loginAt: {
        gte: lockoutThreshold,
      },
    },
  });
}
