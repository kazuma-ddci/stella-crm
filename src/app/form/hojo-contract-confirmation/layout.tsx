import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "契約内容確認フォーム",
  description: "契約内容確認フォーム",
};

export default function HojoContractConfirmationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
