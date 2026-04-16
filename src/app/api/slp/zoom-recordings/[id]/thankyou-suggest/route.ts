import { NextResponse } from "next/server";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { generateThankYouSuggestion } from "@/lib/slp/zoom-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, message: "invalid id" }, { status: 400 });
  }
  try {
    const result = await generateThankYouSuggestion({ recordingId: id });
    return NextResponse.json({ ok: true, text: result.text, model: result.model });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
