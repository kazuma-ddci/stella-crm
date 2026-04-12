import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSlpRemind, isRemindable } from "@/lib/slp-cloudsign";
import { sendSlpRemindLegacy } from "@/lib/slp-cloudsign-legacy";
import { logAutomationError } from "@/lib/automation-error";

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

    // CloudSign リマインド送信（MasterContract経由 or レガシー）
    const contract = await prisma.masterContract.findFirst({
      where: {
        slpMemberId: member.id,
        cloudsignStatus: "sent",
        cloudsignDocumentId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (contract) {
      await sendSlpRemind(contract.id);
    } else {
      await sendSlpRemindLegacy(member.documentId);
    }

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
    await logAutomationError({
      source: "slp-member-remind",
      message: `組合員への契約書リマインド送信に失敗しました`,
      detail: {
        originalError: String(error),
        hint: "CloudSignの設定や契約書の状態を確認してください。必要に応じて手動でリマインドを送信してください。",
      },
    });
    return NextResponse.json(
      { success: false, error: "リマインドの送信に失敗しました" },
      { status: 500 }
    );
  }
}
