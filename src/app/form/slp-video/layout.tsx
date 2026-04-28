import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "動画閲覧ページ",
  description: "動画閲覧ページ",
};

export default function SlpVideoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
