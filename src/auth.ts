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
      name: string;
      email: string | null;
      userType: UserType;
      permissions: UserPermission[];
      // 外部ユーザー用
      companyId?: number;
      companyName?: string;
      displayViews?: DisplayViewPermission[];
    };
  }

  interface User {
    id: string;
    name: string;
    email: string | null;
    userType: UserType;
    permissions: UserPermission[];
    // 外部ユーザー用
    companyId?: number;
    companyName?: string;
    displayViews?: DisplayViewPermission[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: number;
    name: string;
    email: string | null;
    userType: UserType;
    permissions: UserPermission[];
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // 1. まず社内スタッフで認証を試みる
        const staff = await prisma.masterStaff.findUnique({
          where: { email },
          include: {
            permissions: true,
          },
        });

        if (staff && staff.passwordHash && staff.isActive) {
          const isValid = await bcrypt.compare(password, staff.passwordHash);
          if (isValid) {
            const permissions: UserPermission[] = staff.permissions.map(
              (p) => ({
                projectCode: p.projectCode,
                permissionLevel: p.permissionLevel as PermissionLevel,
              })
            );

            return {
              id: String(staff.id),
              name: staff.name,
              email: staff.email,
              userType: "staff" as UserType,
              permissions,
            };
          }
        }

        // 2. 社内スタッフで認証できなければ外部ユーザーを試す
        const externalUser = await authenticateExternalUser(email, password);

        if (externalUser) {
          return {
            id: String(externalUser.id),
            name: externalUser.name,
            email: externalUser.email,
            userType: "external" as UserType,
            permissions: [], // 外部ユーザーはpermissionsを使わない
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
        token.id = Number(user.id);
        token.name = user.name ?? "";
        token.email = user.email ?? null;
        token.userType = user.userType ?? "staff";
        token.permissions = user.permissions ?? [];

        // 外部ユーザー用
        if (user.userType === "external") {
          token.companyId = user.companyId;
          token.companyName = user.companyName;
          token.displayViews = user.displayViews ?? [];
        }
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).id = token.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).userType = token.userType ?? "staff";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).permissions = token.permissions ?? [];

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
