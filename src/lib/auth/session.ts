import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/types/auth";

export async function getSession(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function getOptionalSession(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}
