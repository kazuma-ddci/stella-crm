"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProvider({
  children,
  refetchInterval,
}: {
  children: ReactNode;
  refetchInterval?: number;
}) {
  return (
    <NextAuthSessionProvider refetchInterval={refetchInterval}>
      {children}
    </NextAuthSessionProvider>
  );
}
