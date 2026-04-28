import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "事業計画書作成フォーム",
  description: "中小企業デジタル促進支援制度に伴う事業計画書作成のための情報回収フォーム",
};

export default function HojoBusinessPlanLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
