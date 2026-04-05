import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "借入申込フォーム",
  description: "借入申込フォーム",
};

export default function LoanApplicationLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
