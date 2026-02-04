import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, password } = body;

  if (!token || !password) {
    return NextResponse.json(
      { error: "トークンとパスワードは必須です" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "パスワードは8文字以上で入力してください" },
      { status: 400 }
    );
  }

  const staff = await prisma.masterStaff.findUnique({
    where: { inviteToken: token },
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
      { error: "トークンの有効期限が切れています" },
      { status: 400 }
    );
  }

  // パスワードをハッシュ化して保存
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.masterStaff.update({
    where: { id: staff.id },
    data: {
      passwordHash,
      inviteToken: null, // トークンを無効化
      inviteTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
