import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "初回提出書類 | 公的制度教育推進協会",
  description: "源泉徴収簿・算定基礎届・賃金台帳の提出フォーム",
};

export default function SlpInitialDocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
