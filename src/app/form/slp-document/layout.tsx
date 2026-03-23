import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "組合員限定資料",
  description: "組合員限定の資料閲覧ページ",
};

export default function SlpDocumentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
