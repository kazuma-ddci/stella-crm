import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type {
  UserPermission,
  PermissionLevel,
  UserType,
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
      // 外部ユーザー用
      companyId?: number;
      companyName?: string;
      displayViews?: DisplayViewPermission[];
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
    // 外部ユーザー用
    companyId?: number;
    companyName?: string;
    displayViews?: DisplayViewPermission[];
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
    permissionsCheckedAt?: number;
    permissionsExpired?: boolean;
    // 外部ユーザー用
    companyId?: number;
    companyName?: string;
    displayViews?: DisplayViewPermission[];
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

        if (staff && staff.passwordHash && staff.isActive) {
          const isValid = await bcrypt.compare(password, staff.passwordHash);
          if (isValid) {
            const permissions: UserPermission[] = staff.permissions.map(
              (p) => ({
                projectCode: p.project.code,
                permissionLevel: p.permissionLevel as PermissionLevel,
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
            companyId: externalUser.companyId,
            companyName: externalUser.companyName,
            displayViews: externalUser.displayViews,
          };
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
        token.permissionsCheckedAt = Date.now();

        // 外部ユーザー用
        if (user.userType === "external") {
          token.companyId = user.companyId;
          token.companyName = user.companyName;
          token.displayViews = user.displayViews ?? [];
        }
      } else if (token.userType === "staff" && token.id && !token.permissionsExpired) {
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
                .map((p) => `${p.project.code}:${p.permissionLevel}`)
                .sort()
                .join(",");
              const tokenPerms = (token.permissions ?? [])
                .map((p) => `${p.projectCode}:${p.permissionLevel}`)
                .sort()
                .join(",");
              if (dbPerms !== tokenPerms) {
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

      // 外部ユーザー用
      if (token.userType === "external") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).companyId = token.companyId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).companyName = token.companyName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).displayViews = token.displayViews ?? [];
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
