import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    })),
  });
}
