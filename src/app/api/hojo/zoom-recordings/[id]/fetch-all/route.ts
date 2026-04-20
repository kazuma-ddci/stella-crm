import { NextResponse } from "next/server";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { fetchAllForRecording } from "@/lib/hojo/zoom-recording-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json(
      { ok: false, message: "invalid id" },
      { status: 400 }
    );
  }
  try {
    const result = await fetchAllForRecording(id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
