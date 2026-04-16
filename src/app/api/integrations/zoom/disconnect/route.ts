import { NextRequest, NextResponse } from "next/server";
import { requireStaff, requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { disconnectZoomForStaff } from "@/lib/zoom/oauth";

/**
 * POST /api/integrations/zoom/disconnect
 * body: { targetStaffId?: number }
 * - targetStaffId 省略 → 自分自身の解除（誰でも可）
 * - targetStaffId 指定 → SLP manager以上のみ可能
 */
export async function POST(req: NextRequest) {
  const user = await requireStaff();
  let targetStaffId: number | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.targetStaffId === "number") {
      targetStaffId = body.targetStaffId;
    }
  } catch {
    // noop
  }

  const actualTarget = targetStaffId ?? user.id;

  if (actualTarget !== user.id) {
    // 他人解除 → manager以上必須
    await requireStaffWithProjectPermission([
      { project: "slp", level: "manager" },
    ]);
  }

  try {
    await disconnectZoomForStaff({
      staffId: actualTarget,
      actingStaffId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
