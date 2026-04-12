import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/slp/member-prefill?uid=xxx
 *
 * 再訪問時にフォームに前回の入力データをプリフィルするためのAPI。
 * 不達状態、フロー制御フラグ、契約状態も返す。
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ exists: false });
  }

  const member = await prisma.slpMember.findUnique({
    where: { uid },
    select: {
      status: true,
      deletedAt: true,
      cloudsignBounced: true,
      cloudsignBouncedEmail: true,
      bounceConfirmedAt: true,
      bounceFixUsed: true,
      emailChangeUsed: true,
      formLocked: true,
      autoSendLocked: true,
      memberCategory: true,
      lineName: true,
      name: true,
      position: true,
      email: true,
      phone: true,
      company: true,
      address: true,
      contractSignedDate: true,
      contractSentDate: true,
    },
  });

  if (!member || member.deletedAt) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    status: member.status,
    cloudsignBounced: member.cloudsignBounced,
    cloudsignBouncedEmail: member.cloudsignBouncedEmail,
    bounceConfirmedAt: member.bounceConfirmedAt?.toISOString() ?? null,
    bounceFixUsed: member.bounceFixUsed,
    emailChangeUsed: member.emailChangeUsed,
    formLocked: member.formLocked,
    autoSendLocked: member.autoSendLocked,
    memberCategory: member.memberCategory,
    lineName: member.lineName,
    name: member.name,
    position: member.position,
    email: member.email,
    phone: member.phone,
    company: member.company,
    address: member.address,
    contractSignedDate: member.contractSignedDate?.toISOString() ?? null,
    contractSentDate: member.contractSentDate?.toISOString() ?? null,
  });
}
