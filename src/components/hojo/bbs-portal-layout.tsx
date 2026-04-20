"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  PortalHeader,
  PortalUserMenu,
  PortalSidebar,
  PortalLayout,
} from "@/components/alkes-portal";

type Props = {
  userName?: string;
  isBbs: boolean;
  pageTitle: string;
  children: React.ReactNode;
};

const MENU_ITEMS = [
  {
    key: "support",
    label: "支援金管理",
    href: "/hojo/bbs",
    title: "支援金管理ページ",
  },
  {
    key: "answers",
    label: "フォーム回答",
    href: "/hojo/bbs/form-answers",
    title: "支援制度申請フォーム",
  },
];

function getActiveKey(pathname: string): string {
  if (pathname.startsWith("/hojo/bbs/form-answers")) return "answers";
  return "support";
}

export function BbsPortalLayout({ userName, isBbs, pageTitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const activeKey = getActiveKey(pathname ?? "");

  const header = (
    <PortalHeader
      title="BBS社様専用ポータル"
      rightContent={
        isBbs && userName ? (
          <PortalUserMenu
            userName={userName}
            onLogout={() => signOut({ callbackUrl: "/hojo/bbs" })}
          />
        ) : undefined
      }
    />
  );

  const sidebar = (
    <PortalSidebar
      sections={[
        {
          label: "BBS社向け",
          items: MENU_ITEMS.map((m) => ({ key: m.key, label: m.label })),
        },
      ]}
      activeKey={activeKey}
      onSelect={(key) => {
        const item = MENU_ITEMS.find((m) => m.key === key);
        if (item) router.push(item.href);
      }}
    />
  );

  return (
    <PortalLayout header={header} sidebar={sidebar} pageTitle={pageTitle}>
      {children}
    </PortalLayout>
  );
}
