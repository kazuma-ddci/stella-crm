/**
 * SLP 後追い紐付けフォーム送信API
 *
 * フローの概要:
 *   1. uid が既に SlpMember に紐付いていれば「既存ユーザー」扱いで早期 return
 *      （フォーム側で /form/slp-member にリダイレクトする）
 *   2. 同 uid で既に SlpLineLinkRequest があれば 1度のみ送信ルールにより
 *      現在のステータスをそのまま返す（クライアントはそれに応じた画面表示）
 *   3. 共通ヘルパー attemptLineLink で紐付け試行
 *   4. 結果を SlpLineLinkRequest に upsert して、フロント向けに type を返す
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  attemptLineLink,
  normalizeEmail,
  persistLinkRequestOutcome,
  outcomeToResponseType,
  persistedStatusToResponseType,
} from "@/lib/slp-link-recovery";
import { logAutomationError } from "@/lib/automation-error";

interface RequestBody {
  uid?: string;
  lineName?: string;
  email?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const uid = (body.uid ?? "").trim();
    const lineName = (body.lineName ?? "").trim();
    const emailRaw = (body.email ?? "").trim();

    // 入力バリデーション
    if (!uid) {
      return NextResponse.json(
        { success: false, type: "error", error: "uidが指定されていません" },
        { status: 400 }
      );
    }
    if (!lineName) {
      return NextResponse.json(
        { success: false, type: "error", error: "LINE名を入力してください" },
        { status: 400 }
      );
    }
    if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
      return NextResponse.json(
        { success: false, type: "error", error: "有効なメールアドレスを入力してください" },
        { status: 400 }
      );
    }

    const email = normalizeEmail(emailRaw);

    // ----------------------------------------------------------------
    // 1. uid が既に SlpMember に紐付いている場合は受け付けない
    //    （フォーム側で /form/slp-member にリダイレクトしてもらう）
    // ----------------------------------------------------------------
    const existingMember = await prisma.slpMember.findUnique({
      where: { uid },
      select: { id: true },
    });
    if (existingMember) {
      return NextResponse.json({
        success: false,
        type: "already_linked",
      });
    }

    // ----------------------------------------------------------------
    // 2. 1度のみ送信ルール: 既に申請レコードがあれば現状ステータスを返す
    //    （再送信はできない。Re-fetch不要でクライアント側はそのまま画面表示）
    // ----------------------------------------------------------------
    const existingRequest = await prisma.slpLineLinkRequest.findUnique({
      where: { uid },
      select: { status: true, beaconType: true },
    });
    if (existingRequest) {
      return NextResponse.json({
        success: false,
        type: "already_submitted",
        currentType: persistedStatusToResponseType(
          existingRequest.status,
          existingRequest.beaconType
        ),
      });
    }

    // ----------------------------------------------------------------
    // 3. 紐付け試行
    // ----------------------------------------------------------------
    const outcome = await attemptLineLink({
      uid,
      submittedLineName: lineName,
      submittedEmail: email,
      source: "form",
    });

    // ----------------------------------------------------------------
    // 4. 結果を保存
    // ----------------------------------------------------------------
    await persistLinkRequestOutcome({
      uid,
      submittedLineName: lineName,
      submittedEmail: email,
      outcome,
      source: "form",
    });

    return NextResponse.json({
      success: true,
      type: outcomeToResponseType(outcome),
    });
  } catch (err) {
    console.error("[member-link] failed:", err);
    await logAutomationError({
      source: "api/public/slp/member-link",
      message: `後追い紐付けフォーム処理失敗`,
      detail: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { success: false, type: "error", error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
