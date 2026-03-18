import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "組合員入会申込フォーム",
  description: "一般社団法人 公的制度教育推進協会 組合員入会申込フォーム",
};

export default function SlpMemberFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
