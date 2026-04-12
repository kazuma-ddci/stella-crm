import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/slp/member-bounced-check?uid=xxx
 *
 * フォーム送信後の10秒ポーリングで使用。
 * CloudSign の BOUNCED（メール不達）が発生したかチェックする。
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ bounced: false, bouncedEmail: null });
  }

  const member = await prisma.slpMember.findUnique({
    where: { uid },
    select: {
      cloudsignBounced: true,
      cloudsignBouncedEmail: true,
    },
  });

  if (!member) {
    return NextResponse.json({ bounced: false, bouncedEmail: null });
  }

  return NextResponse.json({
    bounced: member.cloudsignBounced,
    bouncedEmail: member.cloudsignBouncedEmail,
  });
}
