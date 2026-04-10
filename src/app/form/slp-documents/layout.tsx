import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "書類提出 | 公的制度教育推進協会",
  description: "初回提出書類・追加提出書類の提出フォーム",
};

export default function SlpDocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
