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
  "/reset-password",
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
  "/admin",
];

// 外部ユーザー専用パス
const EXTERNAL_ONLY_PATHS = ["/portal"];

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

function getRequiredProject(pathname: string): ProjectCode | null {
  if (pathname.startsWith("/stp")) {
    return "stp";
  }
  if (
    pathname.startsWith("/companies") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/settings")
  ) {
    return "stella";
  }
  return null;
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
    return NextResponse.next();
  }

  // 認証チェック
  const session = request.auth;
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
