import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const staff = await prisma.masterStaff.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      inviteTokenExpiresAt: true,
      passwordHash: true,
    },
  });

  if (!staff) {
    return NextResponse.json(
      { error: "無効なトークンです" },
      { status: 404 }
    );
  }

  if (staff.passwordHash) {
    return NextResponse.json(
      { error: "このアカウントは既に設定済みです" },
      { status: 400 }
    );
  }

  if (staff.inviteTokenExpiresAt && staff.inviteTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "トークンの有効期限が切れています。管理者に再発行を依頼してください" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
  });
}
