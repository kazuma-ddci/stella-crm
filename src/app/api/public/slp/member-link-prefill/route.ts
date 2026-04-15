/**
 * SLP 後追い紐付けフォームの再訪問プリフィルAPI
 *
 * 戻り値の type で画面分岐:
 *   - "redirect_to_member_form" : uid が既に SlpMember に紐付いている → /form/slp-member に飛ばす
 *   - "resolved_signed"         : 申請完了（締結済み）
 *   - "resolved_sent"           : 申請完了（送付済み）
 *   - "resolved_pending"        : 申請完了（ステータス想定外でビーコン未発火）
 *   - "pending_friend_sync"     : 友だち情報同期待ち
 *   - "pending_staff_review"    : スタッフ確認中
 *   - "email_not_found"         : メールアドレス未発見
 *   - "rejected"                : スタッフ却下済み
 *   - "no_record"               : まだ申請なし → フォーム表示
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { persistedStatusToResponseType } from "@/lib/slp-link-recovery";

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ type: "no_uid" });
  }

  // uid が既に SlpMember に紐付いている → 既存ユーザー、組合員フォームへ
  const existingMember = await prisma.slpMember.findUnique({
    where: { uid },
    select: { id: true },
  });
  if (existingMember) {
    return NextResponse.json({ type: "redirect_to_member_form" });
  }

  const record = await prisma.slpLineLinkRequest.findUnique({
    where: { uid },
    select: { status: true, beaconType: true },
  });

  if (!record) {
    return NextResponse.json({ type: "no_record" });
  }

  return NextResponse.json({
    type: persistedStatusToResponseType(record.status, record.beaconType),
  });
}
