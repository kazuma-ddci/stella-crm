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
  "/hojo/bbs",
  "/hojo/vendor",
  "/hojo/lender",
];

// 社内スタッフ専用パス
const STAFF_ONLY_PATHS = [
  "/companies",
  "/staff",
  "/settings",
  "/stp",
  "/slp",
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

// PJ固有固定データパス（admin + stella001 + founder + いずれかのPJでview以上）
// 注: /stp/settings/*, /slp/settings/* 等のPJ固有パスはここに含めない
//     → 一般のPJ権限チェック（getRequiredProject）で該当PJの権限を確認する
const PROJECT_MASTER_DATA_PATHS = [
  "/settings/customer-types",
  "/settings/contact-categories",
  "/settings/display-views",
  "/settings/lead-sources",
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
  if (pathname.startsWith("/slp")) {
    return "slp";
  }
  if (pathname.startsWith("/accounting")) {
    return "accounting";
  }
  if (pathname.startsWith("/hojo")) {
    return "hojo";
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
 * いずれかのプロジェクトで権限があるかチェック（view以上）
 */
function hasAnyPermission(
  permissions: Array<{ projectCode: string; permissionLevel: string }>
): boolean {
  return permissions.some((p) => p.permissionLevel !== "none");
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

// 外部ドメイン（BBS・ベンダー・貸金業社用）で許可するパス
const EXTERNAL_DOMAIN_ALLOWED_PATHS = [
  "/hojo/bbs",
  "/hojo/vendor",
  "/hojo/lender",
  "/login",
  "/api/auth",
  "/register",
  "/api/public",
  "/form",
];

function isExternalDomainAllowedPath(pathname: string): boolean {
  return EXTERNAL_DOMAIN_ALLOWED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

// 外部ドメインかどうか判定
function isExternalDomain(host: string): boolean {
  return host.endsWith(".alkes.jp");
}

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // 外部ドメイン（*.alkes.jp）からのアクセス制限
  if (isExternalDomain(host)) {
    if (!isExternalDomainAllowedPath(pathname) && !pathname.startsWith("/_next/") && !pathname.startsWith("/api/auth")) {
      return new NextResponse(null, { status: 404 });
    }
  }

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
        const redirectUrl =
          userType === "external" ? "/portal" :
          userType === "bbs" ? "/hojo/bbs" :
          userType === "vendor" ? "/hojo/vendor" :
          userType === "lender" ? "/hojo/lender" :
          "/";
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

  // PJ固有固定データパス: いずれかのプロジェクトで権限があれば許可（閲覧/編集はページ側で制御）
  if (isProjectMasterDataPath(pathname)) {
    if (isAdminUser || canEditMasterData || isFounderUser || hasAnyPermission(userPermissions)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // BBSユーザーは /hojo/bbs/* のみアクセス可
  if (userType === "bbs") {
    if (!pathname.startsWith("/hojo/bbs")) {
      return NextResponse.redirect(new URL("/hojo/bbs", request.url));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mustChangePassword = !!(session.user as any).mustChangePassword;
    if (mustChangePassword && !pathname.startsWith("/hojo/bbs/change-password")) {
      return NextResponse.redirect(new URL("/hojo/bbs/change-password", request.url));
    }
    return NextResponse.next();
  }

  // ベンダーユーザーは /hojo/vendor/* のみアクセス可
  if (userType === "vendor") {
    if (!pathname.startsWith("/hojo/vendor")) {
      return NextResponse.redirect(new URL("/hojo/vendor", request.url));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mustChangePassword = !!(session.user as any).mustChangePassword;
    if (mustChangePassword && !pathname.startsWith("/hojo/vendor/change-password")) {
      return NextResponse.redirect(new URL("/hojo/vendor/change-password", request.url));
    }
    return NextResponse.next();
  }

  // 貸金業社ユーザーは /hojo/lender/* のみアクセス可
  if (userType === "lender") {
    if (!pathname.startsWith("/hojo/lender")) {
      return NextResponse.redirect(new URL("/hojo/lender", request.url));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mustChangePassword = !!(session.user as any).mustChangePassword;
    if (mustChangePassword && !pathname.startsWith("/hojo/lender/change-password")) {
      return NextResponse.redirect(new URL("/hojo/lender/change-password", request.url));
    }
    return NextResponse.next();
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

    // /staff: いずれかのプロジェクトで権限があれば許可（閲覧のみ/編集はページ側で制御）
    if (pathname.startsWith("/staff")) {
      if (!isFounderUser && !hasAnyPermission(userPermissions) && !isAdminUser) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // /admin: いずれかのプロジェクトで権限があれば許可（閲覧のみ/編集はページ側で制御）
    if (pathname.startsWith("/admin")) {
      if (!isAdminUser && !isFounderUser && !hasAnyPermission(userPermissions)) {
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
    "/((?!_next/static|_next/image|favicon.ico|images/|api/cron/|api/cloudsign/webhook|api/health|api/build-id|api/slp/videos/upload|api/slp/documents/upload).*)",
  ],
};
