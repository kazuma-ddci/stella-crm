import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { DisplayViewPermission } from "@/types/auth";

export interface ExternalUserAuthResult {
  id: number;
  name: string;
  email: string;
  companyId: number;
  companyName: string;
  displayViews: DisplayViewPermission[];
}

/**
 * 外部ユーザーの認証を行う
 */
export async function authenticateExternalUser(
  email: string,
  password: string
): Promise<ExternalUserAuthResult | null> {
  // メールアドレスでユーザーを検索
  const user = await prisma.externalUser.findUnique({
    where: { email },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      displayPermissions: {
        include: {
          displayView: {
            select: {
              viewKey: true,
              viewName: true,
              project: { select: { code: true } },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // アカウントがアクティブか確認
  if (user.status !== "active") {
    return null;
  }

  // パスワード検証
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // 最終ログイン日時を更新
  await prisma.externalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // 表示権限を整形
  const displayViews: DisplayViewPermission[] = user.displayPermissions.map(
    (permission) => ({
      viewKey: permission.displayView.viewKey,
      viewName: permission.displayView.viewName,
      projectCode: permission.displayView.project.code,
    })
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    companyId: user.company.id,
    companyName: user.company.name,
    displayViews,
  };
}

/**
 * 外部ユーザーのログイン履歴を記録
 */
export async function recordLoginHistory(
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
 * 外部ユーザーが特定のビューにアクセスできるか確認
 */
export function hasViewAccess(
  displayViews: DisplayViewPermission[],
  viewKey: string
): boolean {
  return displayViews.some((view) => view.viewKey === viewKey);
}

/**
 * 外部ユーザーが特定のプロジェクトにアクセスできるか確認
 */
export function hasProjectAccess(
  displayViews: DisplayViewPermission[],
  projectCode: string
): boolean {
  return displayViews.some((view) => view.projectCode === projectCode);
}
