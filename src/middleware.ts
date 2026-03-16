import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { ProjectCode, UserType, DisplayViewPermission } from "@/types/auth";

// 公開パス（認証不要）
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/api/forgot-password",
  "/reset-password",
  "/api/reset-password",
  "/form",
  "/api/public",
  "/s",
  "/staff/setup",
  "/api/staff/setup",
];

// 社内スタッフ専用パス
const STAFF_ONLY_PATHS = [
  "/companies",
  "/staff",
  "/settings",
  "/stp",
  "/accounting",
  "/admin",
];

// 外部ユーザー専用パス
const EXTERNAL_ONLY_PATHS = ["/portal"];

// 共通固定データパス（admin + stella001のみ）
const COMMON_MASTER_DATA_PATHS = [
  "/settings/projects",
  "/settings/contact-methods",
  "/settings/contract-statuses",
  "/settings/operating-companies",
];

// PJ固有固定データパス（admin + stella001 + founder + manager）
const PROJECT_MASTER_DATA_PATHS = [
  "/settings/customer-types",
  "/settings/contact-categories",
  "/settings/display-views",
  "/settings/lead-sources",
  "/stp/settings/stages",
  "/staff/role-types",
  "/staff/field-restrictions",
  "/settings/email-templates",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isStaffOnlyPath(pathname: string): boolean {
  return STAFF_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isExternalOnlyPath(pathname: string): boolean {
  return EXTERNAL_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isCommonMasterDataPath(pathname: string): boolean {
  return COMMON_MASTER_DATA_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function isProjectMasterDataPath(pathname: string): boolean {
  return PROJECT_MASTER_DATA_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function getRequiredProject(pathname: string): ProjectCode | null {
  if (pathname.startsWith("/stp")) {
    return "stp";
  }
  if (pathname.startsWith("/accounting")) {
    return "accounting";
  }
  if (pathname.startsWith("/settings")) {
    return "stella";
  }
  // /companies はいずれかのプロジェクトでedit以上なら許可（後続で個別チェック）
  if (pathname.startsWith("/companies")) {
    return null;
  }
  return null;
}

/**
 * いずれかのプロジェクトでedit以上の権限があるかチェック
 */
function hasAnyEditPermission(
  permissions: Array<{ projectCode: string; permissionLevel: string }>
): boolean {
  const editLevels = new Set(["edit", "manager"]);
  return permissions.some((p) => editLevels.has(p.permissionLevel));
}

/**
 * いずれかのプロジェクトでmanager権限があるかチェック
 */
function hasAnyManagerPermission(
  permissions: Array<{ projectCode: string; permissionLevel: string }>
): boolean {
  return permissions.some((p) => p.permissionLevel === "manager");
}

function hasPermission(
  permissions: Array<{ projectCode: string; permissionLevel: string }>,
  projectCode: ProjectCode
): boolean {
  const permission = permissions.find((p) => p.projectCode === projectCode);
  if (!permission) {
    return false;
  }
  return permission.permissionLevel !== "none";
}

function getRequiredViewForPortal(pathname: string): string | null {
  if (pathname.startsWith("/portal/stp")) {
    // /portal/stp/client or /portal/stp/agent
    if (pathname.includes("/client")) {
      return "stp_client";
    }
    if (pathname.includes("/agent")) {
      return "stp_agent";
    }
    // /portal/stp だけの場合はどちらかにアクセスできれば良い
    return null;
  }
  return null;
}

function hasViewAccess(
  displayViews: DisplayViewPermission[],
  viewKey: string
): boolean {
  return displayViews.some((view) => view.viewKey === viewKey);
}

function hasAnyStpViewAccess(displayViews: DisplayViewPermission[]): boolean {
  return displayViews.some((view) => view.projectCode === "stp");
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // /uploads/* → /api/uploads/* にリライト（standaloneモードではpublic/が配信されないため）
  if (pathname.startsWith("/uploads/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/api${pathname}`;
    return NextResponse.rewrite(url);
  }

  // 権限変更検知: permissionsExpired の場合はページ遷移をブロックしない。
  // クライアント側の PermissionGuard が signOut() を呼んで正しくログアウトする。
  // middleware では cookie を直接操作しない（auth() ラッパーとの競合を防止）。
  const session = request.auth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissionsExpired = !!(session?.user && (session as any).permissionsExpired);

  // 公開パスは許可
  if (isPublicPath(pathname)) {
    // ただし /login は認証済み（かつ権限有効）ならリダイレクト
    if (pathname === "/login") {
      if (session?.user && !permissionsExpired) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userType = (session.user as any).userType ?? "staff";
        const redirectUrl = userType === "external" ? "/portal" : "/";
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    return NextResponse.next();
  }

  // 認証チェック
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userType = ((session.user as any).userType ?? "staff") as UserType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPermissions = (session.user as any).permissions ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayViews = ((session.user as any).displayViews ??
    []) as DisplayViewPermission[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEditMasterData = (session.user as any).canEditMasterData === true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const organizationRole = (session.user as any).organizationRole ?? "member";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loginId = (session.user as any).loginId as string | null;
  const isAdminUser = loginId === "admin";
  const isFounderUser = organizationRole === "founder";

  // 固定データ管理者（stella001）: 固定データパスのみアクセス可能
  if (canEditMasterData && !isAdminUser) {
    if (isCommonMasterDataPath(pathname) || isProjectMasterDataPath(pathname)) {
      return NextResponse.next();
    }
    // それ以外はすべて固定データ設定にリダイレクト
    return NextResponse.redirect(new URL("/settings/projects", request.url));
  }

  // 共通固定データパス: admin + stella001のみ
  if (isCommonMasterDataPath(pathname)) {
    if (isAdminUser || canEditMasterData) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // PJ固有固定データパス: admin + stella001 + founder + manager
  if (isProjectMasterDataPath(pathname)) {
    if (isAdminUser || canEditMasterData || isFounderUser || hasAnyManagerPermission(userPermissions)) {
      return NextResponse.next();
    }
    // メールテンプレートはstella閲覧権限でもアクセス可
    if (
      (pathname === "/settings/email-templates" ||
        pathname.startsWith("/settings/email-templates/")) &&
      hasPermission(userPermissions, "stella")
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ユーザータイプに応じたリダイレクト
  if (userType === "external") {
    // 外部ユーザーがスタッフ専用パスにアクセスしようとした場合
    if (isStaffOnlyPath(pathname)) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    // ポータル内の権限チェック
    if (isExternalOnlyPath(pathname)) {
      const requiredView = getRequiredViewForPortal(pathname);

      if (requiredView) {
        if (!hasViewAccess(displayViews, requiredView)) {
          return NextResponse.redirect(new URL("/portal", request.url));
        }
      } else if (pathname.startsWith("/portal/stp")) {
        // /portal/stp へのアクセスはいずれかのSTPビューがあれば許可
        if (!hasAnyStpViewAccess(displayViews)) {
          return NextResponse.redirect(new URL("/portal", request.url));
        }
      }
    }

    // ダッシュボード（/）へのアクセスはポータルへリダイレクト
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  } else {
    // 社内スタッフが外部ユーザー専用パスにアクセスしようとした場合
    if (isExternalOnlyPath(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // /companies: founderまたはいずれかのプロジェクトでedit以上なら許可
    if (pathname.startsWith("/companies")) {
      if (!isFounderUser && !hasAnyEditPermission(userPermissions) && !isAdminUser) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // /staff: founderまたはいずれかのプロジェクトでedit以上なら許可
    if (pathname.startsWith("/staff")) {
      if (!isFounderUser && !hasAnyEditPermission(userPermissions) && !isAdminUser) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // /admin: edit以上で外部ユーザー管理にアクセス可
    if (pathname.startsWith("/admin")) {
      if (!isAdminUser && !isFounderUser && !hasAnyEditPermission(userPermissions)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // 社内スタッフ用のプロジェクト権限チェック（adminユーザー・founderはバイパス）
    if (!isAdminUser && !isFounderUser) {
      const requiredProject = getRequiredProject(pathname);
      if (requiredProject) {
        if (!hasPermission(userPermissions, requiredProject)) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|api/cron/|api/cloudsign/webhook|api/health/|api/build-id).*)",
  ],
};
