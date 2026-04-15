import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "公式LINE紐付けフォーム",
  description:
    "一般社団法人 公的制度教育推進協会 組合員様向け 公式LINE紐付けフォーム",
};

export default function SlpMemberLinkFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
