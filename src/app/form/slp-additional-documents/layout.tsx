import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "追加提出書類 | 公的制度教育推進協会",
  description:
    "被保険者資格取得届・月額変更届・賞与支払届・標準報酬決定通知書の提出フォーム",
};

export default function SlpAdditionalDocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
