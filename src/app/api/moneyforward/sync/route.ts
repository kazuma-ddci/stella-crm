import { NextRequest, NextResponse } from "next/server";
import { syncMoneyForwardTransactions } from "@/lib/moneyforward/sync";
import { authorizeApi } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    // 経理プロジェクトの編集権限以上のスタッフのみ
    const authz = await authorizeApi([
      { project: "accounting", level: "edit" },
    ]);
    if (!authz.ok) return authz.response;

    const body = await request.json();
    const { connectionId } = body as { connectionId: number };

    if (!connectionId || typeof connectionId !== "number") {
      return NextResponse.json(
        { error: "connectionId が必要です" },
        { status: 400 }
      );
    }

    const result = await syncMoneyForwardTransactions(connectionId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("MoneyForward sync error:", error);
    const message =
      error instanceof Error ? error.message : "同期中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
