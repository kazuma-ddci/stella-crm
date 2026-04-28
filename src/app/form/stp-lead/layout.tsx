import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "採用ブースト【事前アンケート】",
  description: "採用ブースト 事前アンケート",
};

export default function StpLeadFormLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
