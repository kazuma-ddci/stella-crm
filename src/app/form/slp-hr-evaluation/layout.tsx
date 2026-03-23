import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "人事評価制度再設計（必要書類提出フォーム）",
  description: "一般社団法人 公的制度教育推進協会 人事評価制度再設計 必要書類提出フォーム",
};

export default function SlpHrEvaluationFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
