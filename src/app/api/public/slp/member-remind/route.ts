import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlpRemind, isRemindable } from "@/lib/slp-cloudsign";

/**
 * POST /api/public/slp/member-remind
 *
 * フォーム上のリマインドボタンから呼ばれる。
 * 1回のフォーム表示で1度だけ押せる（フロント制御）。
 */

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "ユーザー情報が不足しています" },
        { status: 400 }
      );
    }

    const member = await prisma.slpMember.findUnique({
      where: { uid },
    });

    if (!member || member.deletedAt) {
      return NextResponse.json(
        { success: false, error: "メンバーが見つかりません" },
        { status: 404 }
      );
    }

    if (member.status !== "契約書送付済") {
      return NextResponse.json(
        { success: false, error: "リマインド対象のステータスではありません" },
        { status: 400 }
      );
    }

    if (!member.documentId) {
      return NextResponse.json(
        { success: false, error: "契約書のドキュメントIDがありません" },
        { status: 400 }
      );
    }

    if (!isRemindable(member.contractSentDate)) {
      return NextResponse.json(
        { success: false, error: "リマインド可能期間を過ぎています" },
        { status: 400 }
      );
    }

    // CloudSign リマインド送信
    await sendSlpRemind(member.documentId);

    // DB更新
    await prisma.slpMember.update({
      where: { id: member.id },
      data: {
        reminderCount: member.reminderCount + 1,
        lastReminderSentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member remind error:", error);
    return NextResponse.json(
      { success: false, error: "リマインドの送信に失敗しました" },
      { status: 500 }
    );
  }
}
