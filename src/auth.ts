import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type {
  UserPermission,
  PermissionLevel,
  UserType,
  OrganizationRole,
  DisplayViewPermission,
} from "@/types/auth";
import { authenticateExternalUser } from "@/lib/auth/external-user";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      loginId: string | null;
      name: string;
      email: string | null;
      userType: UserType;
      permissions: UserPermission[];
      canEditMasterData: boolean;
      organizationRole: OrganizationRole;
      // 外部ユーザー用
      companyId?: number;
      companyName?: string;
      displayViews?: DisplayViewPermission[];
      // BBSユーザー用
      bbsAccountId?: number;
      mustChangePassword?: boolean;
      // ベンダーユーザー用
      vendorAccountId?: number;
      vendorId?: number;
      vendorName?: string;
      // 貸金業社ユーザー用
      lenderAccountId?: number;
    };
  }

  interface User {
    id: string;
    loginId: string | null;
    name: string;
    email: string | null;
    userType: UserType;
    permissions: UserPermission[];
    canEditMasterData: boolean;
    organizationRole: OrganizationRole;
    // 外部ユーザー用
    companyId?: number;
    companyName?: string;
    displayViews?: DisplayViewPermission[];
    // BBSユーザー用
    bbsAccountId?: number;
    mustChangePassword?: boolean;
    // ベンダーユーザー用
    vendorAccountId?: number;
    vendorId?: number;
    vendorName?: string;
    // 貸金業社ユーザー用
    lenderAccountId?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: number;
    loginId: string | null;
    name: string;
    email: string | null;
    userType: UserType;
    permissions: UserPermission[];
    canEditMasterData: boolean;
    organizationRole: OrganizationRole;
    permissionsCheckedAt?: number;
    permissionsExpired?: boolean;
    // 外部ユーザー用
    companyId?: number;
    companyName?: string;
    displayViews?: DisplayViewPermission[];
    // BBSユーザー用
    bbsAccountId?: number;
    mustChangePassword?: boolean;
    // ベンダーユーザー用
    vendorAccountId?: number;
    vendorId?: number;
    vendorName?: string;
    // 貸金業社ユーザー用
    lenderAccountId?: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Login ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = credentials.identifier as string;
        const password = credentials.password as string;
        const isEmail = identifier.includes("@");

        // 1. まず社内スタッフで認証を試みる
        const staff = isEmail
          ? // メールアドレスの場合: 全スタッフから検索
            await prisma.masterStaff.findUnique({
              where: { email: identifier },
              include: { permissions: { include: { project: true } } },
            })
          : // ログインIDの場合: システム管理者のみ（@stella-crm.local）
            await prisma.masterStaff.findFirst({
              where: {
                loginId: identifier,
                email: { endsWith: "@stella-crm.local" },
              },
              include: { permissions: { include: { project: true } } },
            });

        if (staff && staff.passwordHash) {
          const isValid = await bcrypt.compare(password, staff.passwordHash);
          if (isValid) {
            if (!staff.isActive) {
              const err = new CredentialsSignin();
              err.code = "inactive";
              throw err;
            }

            const permissions: UserPermission[] = staff.permissions.map(
              (p) => ({
                projectCode: p.project.code,
                permissionLevel: p.permissionLevel as PermissionLevel,
                canApprove: p.canApprove,
              })
            );

            return {
              id: String(staff.id),
              loginId: staff.loginId ?? null,
              name: staff.name,
              email: staff.email,
              userType: "staff" as UserType,
              permissions,
              canEditMasterData: staff.canEditMasterData,
              organizationRole: (staff.organizationRole ?? "member") as OrganizationRole,
            };
          }
        }

        // 2. 社内スタッフで認証できなければ外部ユーザーを試す（メールアドレスの場合のみ）
        const externalUser = isEmail
          ? await authenticateExternalUser(identifier, password)
          : null;

        if (externalUser) {
          return {
            id: String(externalUser.id),
            loginId: null,
            name: externalUser.name,
            email: externalUser.email,
            userType: "external" as UserType,
            permissions: [], // 外部ユーザーはpermissionsを使わない
            canEditMasterData: false,
            organizationRole: "member" as OrganizationRole,
            companyId: externalUser.companyId,
            companyName: externalUser.companyName,
            displayViews: externalUser.displayViews,
          };
        }

        // 3. BBSアカウントで認証を試みる（メールアドレスの場合のみ）
        if (isEmail) {
          const bbsAccount = await prisma.hojoBbsAccount.findUnique({
            where: { email: identifier },
          });
          if (bbsAccount) {
            if (bbsAccount.status === "pending_approval") {
              const err = new CredentialsSignin();
              err.code = "pending_approval";
              throw err;
            }
            if (bbsAccount.status === "suspended") {
              const err = new CredentialsSignin();
              err.code = "suspended";
              throw err;
            }
            const isValid = await bcrypt.compare(password, bbsAccount.passwordHash);
            if (isValid) {
              await prisma.hojoBbsAccount.update({
                where: { id: bbsAccount.id },
                data: { lastLoginAt: new Date() },
              });
              return {
                id: String(bbsAccount.id),
                loginId: null,
                name: bbsAccount.name,
                email: bbsAccount.email,
                userType: "bbs" as UserType,
                permissions: [],
                canEditMasterData: false,
                organizationRole: "member" as OrganizationRole,
                bbsAccountId: bbsAccount.id,
                mustChangePassword: bbsAccount.mustChangePassword,
              };
            }
          }
        }

        // 4. ベンダーアカウントで認証を試みる（メールアドレスの場合のみ）
        if (isEmail) {
          const vendorAccount = await prisma.hojoVendorAccount.findUnique({
            where: { email: identifier },
            include: { vendor: { select: { id: true, name: true } } },
          });
          if (vendorAccount) {
            if (vendorAccount.status === "pending_approval") {
              const err = new CredentialsSignin();
              err.code = "pending_approval";
              throw err;
            }
            if (vendorAccount.status === "suspended") {
              const err = new CredentialsSignin();
              err.code = "suspended";
              throw err;
            }
            const isValid = await bcrypt.compare(password, vendorAccount.passwordHash);
            if (isValid) {
              await prisma.hojoVendorAccount.update({
                where: { id: vendorAccount.id },
                data: { lastLoginAt: new Date() },
              });
              return {
                id: String(vendorAccount.id),
                loginId: null,
                name: vendorAccount.name,
                email: vendorAccount.email,
                userType: "vendor" as UserType,
                permissions: [],
                canEditMasterData: false,
                organizationRole: "member" as OrganizationRole,
                vendorAccountId: vendorAccount.id,
                vendorId: vendorAccount.vendor.id,
                vendorName: vendorAccount.vendor.name,
                mustChangePassword: vendorAccount.mustChangePassword,
              };
            }
          }
        }

        // 5. 貸金業社アカウントで認証を試みる（メールアドレスの場合のみ）
        if (isEmail) {
          const lenderAccount = await prisma.hojoLenderAccount.findUnique({
            where: { email: identifier },
          });
          if (lenderAccount) {
            if (lenderAccount.status === "pending_approval") {
              const err = new CredentialsSignin();
              err.code = "pending_approval";
              throw err;
            }
            if (lenderAccount.status === "suspended") {
              const err = new CredentialsSignin();
              err.code = "suspended";
              throw err;
            }
            const isValid = await bcrypt.compare(password, lenderAccount.passwordHash);
            if (isValid) {
              await prisma.hojoLenderAccount.update({
                where: { id: lenderAccount.id },
                data: { lastLoginAt: new Date() },
              });
              return {
                id: String(lenderAccount.id),
                loginId: null,
                name: lenderAccount.name,
                email: lenderAccount.email,
                userType: "lender" as UserType,
                permissions: [],
                canEditMasterData: false,
                organizationRole: "member" as OrganizationRole,
                lenderAccountId: lenderAccount.id,
                mustChangePassword: lenderAccount.mustChangePassword,
              };
            }
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // ログイン時: 初期値をセット
        token.id = Number(user.id);
        token.loginId = user.loginId ?? null;
        token.name = user.name ?? "";
        token.email = user.email ?? null;
        token.userType = user.userType ?? "staff";
        token.permissions = user.permissions ?? [];
        token.canEditMasterData = user.canEditMasterData ?? false;
        token.organizationRole = (user.organizationRole ?? "member") as OrganizationRole;
        token.permissionsCheckedAt = Date.now();

        // 外部ユーザー用
        if (user.userType === "external") {
          token.companyId = user.companyId;
          token.companyName = user.companyName;
          token.displayViews = user.displayViews ?? [];
        }

        // BBSユーザー用
        if (user.userType === "bbs") {
          token.bbsAccountId = user.bbsAccountId;
          token.mustChangePassword = user.mustChangePassword;
        }

        // ベンダーユーザー用
        if (user.userType === "vendor") {
          token.vendorAccountId = user.vendorAccountId;
          token.vendorId = user.vendorId;
          token.vendorName = user.vendorName;
          token.mustChangePassword = user.mustChangePassword;
        }

        // 貸金業社ユーザー用
        if (user.userType === "lender") {
          token.lenderAccountId = user.lenderAccountId;
          token.mustChangePassword = user.mustChangePassword;
        }
      } else if (token.userType === "staff" && token.id && !token.permissionsExpired) {
        // Edge runtime（middleware）ではPrismaが使えないのでスキップ
        // @ts-expect-error EdgeRuntime is defined only in edge runtime
        const isEdge = typeof EdgeRuntime !== "undefined";
        if (isEdge) return token;

        // 既存セッション: セッションリフェッチ時にDBの権限と比較し、変更があれば強制ログアウト
        const now = Date.now();
        const checkedAt = token.permissionsCheckedAt ?? 0;
        if (now - checkedAt >= 10 * 1000) {
          try {
            const staff = await prisma.masterStaff.findUnique({
              where: { id: token.id as number },
              include: { permissions: { include: { project: true } } },
            });
            if (!staff || !staff.isActive) {
              // スタッフが無効化 or 削除された場合
              token.permissionsExpired = true;
            } else {
              // DB権限とトークン権限を比較
              const dbPerms = staff.permissions
                .map((p) => `${p.project.code}:${p.permissionLevel}:${p.canApprove}`)
                .sort()
                .join(",");
              const tokenPerms = (token.permissions ?? [])
                .map((p: { projectCode: string; permissionLevel: string; canApprove?: boolean }) => `${p.projectCode}:${p.permissionLevel}:${p.canApprove ?? false}`)
                .sort()
                .join(",");
              if (dbPerms !== tokenPerms) {
                token.permissionsExpired = true;
              }
              // organizationRoleの変更も検知
              if (staff.organizationRole !== token.organizationRole) {
                token.permissionsExpired = true;
              }
            }
          } catch {
            // DB接続エラー時は既存のセッションを維持
          }
          token.permissionsCheckedAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // 権限変更検知: フラグをセッションに伝搬（middlewareで強制ログアウト）
      if (token.permissionsExpired) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).permissionsExpired = true;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = token.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).loginId = token.loginId ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).userType = token.userType ?? "staff";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).permissions = token.permissions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).canEditMasterData = token.canEditMasterData ?? false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).organizationRole = token.organizationRole ?? "member";

      // 外部ユーザー用
      if (token.userType === "external") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).companyId = token.companyId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).companyName = token.companyName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).displayViews = token.displayViews ?? [];
      }

      // BBSユーザー用
      if (token.userType === "bbs") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).bbsAccountId = token.bbsAccountId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }

      // ベンダーユーザー用
      if (token.userType === "vendor") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).vendorAccountId = token.vendorAccountId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).vendorId = token.vendorId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).vendorName = token.vendorName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }

      // 貸金業社ユーザー用
      if (token.userType === "lender") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).lenderAccountId = token.lenderAccountId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).mustChangePassword = token.mustChangePassword;
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
