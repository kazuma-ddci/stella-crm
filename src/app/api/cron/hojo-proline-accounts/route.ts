import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const accounts = await prisma.hojoProlineAccount.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      lineType: a.lineType,
      label: a.label,
      email: a.email,
      password: a.password,
      loginUrl: a.loginUrl,
    })),
  });
}
