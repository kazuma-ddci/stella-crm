import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, vendorMemo, token } = body;

    if (!id || !token) {
      return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
    }

    // トークンからベンダーを特定
    const vendor = await prisma.hojoVendor.findUnique({
      where: { accessToken: token },
    });

    if (!vendor || !vendor.isActive) {
      return NextResponse.json({ error: "無効なアクセス" }, { status: 403 });
    }

    // 該当レコードがこのベンダーのものか確認
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: Number(id) },
    });

    if (!record || record.vendorId !== vendor.id || record.deletedAt) {
      return NextResponse.json({ error: "レコードが見つかりません" }, { status: 404 });
    }

    // alkesMemoとして更新（vendorMemoは廃止）
    await prisma.hojoApplicationSupport.update({
      where: { id: Number(id) },
      data: { alkesMemo: vendorMemo ? String(vendorMemo).trim() : null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[vendor-memo] error:", err);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
