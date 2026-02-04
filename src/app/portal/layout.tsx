import { SessionProvider } from "next-auth/react";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
