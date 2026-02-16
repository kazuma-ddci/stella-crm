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

// 固定データ編集パス（stella001 + admin権限ユーザー）
const MASTER_DATA_PATHS = [
  "/settings/operating-companies",
  "/settings/projects",
  "/settings/customer-types",
  "/settings/contact-methods",
  "/settings/contract-statuses",
  "/settings/display-views",
  "/settings/lead-sources",
  "/staff/role-types",
  "/stp/settings/stages",
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

function isMasterDataPath(pathname: string): boolean {
  return MASTER_DATA_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

function getRequiredProject(pathname: string): ProjectCode | null {
  if (pathname.startsWith("/stp")) {
    return "stp";
  }
  if (
    pathname.startsWith("/staff") ||
    pathname.startsWith("/settings")
  ) {
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
  const editLevels = new Set(["edit", "admin"]);
  return permissions.some((p) => editLevels.has(p.permissionLevel));
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

  // 公開パスは許可
  if (isPublicPath(pathname)) {
    // ただし /login は認証済みならリダイレクト
    if (pathname === "/login") {
      const session = request.auth;
      if (session?.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userType = (session.user as any).userType ?? "staff";
        const redirectUrl = userType === "external" ? "/portal" : "/";
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
    return NextResponse.next();
  }

  // 認証チェック
  const session = request.auth;
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 権限変更検知: セッションCookieを削除して強制ログアウト
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any).permissionsExpired) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reason", "permissions_changed");
    const response = NextResponse.redirect(loginUrl);
    // NextAuth v5のセッションCookieを削除（HTTP/HTTPS両方に対応）
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("__Secure-authjs.session-token");
    return response;
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

  // admin権限チェック（いずれかのプロジェクトでadmin）
  const isAdmin = userPermissions.some(
    (p: { permissionLevel: string }) => p.permissionLevel === "admin"
  );

  // 固定データ管理者（stella001）: 固定データパスのみアクセス可能
  if (canEditMasterData) {
    if (isMasterDataPath(pathname)) {
      return NextResponse.next();
    }
    // それ以外はすべて固定データ設定にリダイレクト
    return NextResponse.redirect(new URL("/settings/projects", request.url));
  }

  // 固定データパスへのアクセス制御: admin権限があれば許可、それ以外は禁止
  if (isMasterDataPath(pathname)) {
    if (isAdmin) {
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

    // /companies: いずれかのプロジェクトでedit以上なら許可
    if (pathname.startsWith("/companies")) {
      if (!hasAnyEditPermission(userPermissions)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // 社内スタッフ用のプロジェクト権限チェック
    const requiredProject = getRequiredProject(pathname);
    if (requiredProject) {
      if (!hasPermission(userPermissions, requiredProject)) {
        return NextResponse.redirect(new URL("/", request.url));
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
    "/((?!_next/static|_next/image|favicon.ico|images/).*)",
  ],
};
