"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import {
  attemptLineLink,
  persistLinkRequestOutcome,
} from "@/lib/slp-link-recovery";

/**
 * スタッフ手動紐付け: 申請に対して指定組合員を強制的に紐付ける
 * - メアド一致チェックはスキップ（スタッフが選んだ組合員を採用）
 * - 組合員ステータスに応じてビーコンが発火される
 */
export async function resolveLinkRequestManually(
  requestId: number,
  memberId: number,
  staffNote?: string
): Promise<ActionResult> {
  const session = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
  try {
    const request = await prisma.slpLineLinkRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) return err("申請が見つかりません");
    if (request.status === "resolved_auto" || request.status === "resolved_manual") {
      return err("この申請は既に紐付け済みです");
    }
    if (request.status === "rejected") {
      return err("この申請は却下されています");
    }
    if (request.deletedAt) return err("削除済みの申請です");

    const outcome = await attemptLineLink({
      uid: request.uid,
      submittedLineName: request.submittedLineName,
      submittedEmail: request.submittedEmail,
      source: "staff_manual",
      forcedMemberId: memberId,
    });

    await persistLinkRequestOutcome({
      uid: request.uid,
      submittedLineName: request.submittedLineName,
      submittedEmail: request.submittedEmail,
      outcome,
      source: "staff_manual",
      resolvedByStaffId: session.id,
      staffNote,
    });

    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[resolveLinkRequestManually] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * スタッフによる申請却下（嫌がらせ等）
 */
export async function rejectLinkRequest(
  requestId: number,
  staffNote?: string
): Promise<ActionResult> {
  const session = await requireStaffWithProjectPermission([
    { project: "slp", level: "edit" },
  ]);
  try {
    await prisma.slpLineLinkRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        resolvedAt: new Date(),
        resolvedByStaffId: session.id,
        ...(staffNote !== undefined ? { staffNote } : {}),
      },
    });
    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[rejectLinkRequest] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * スタッフメモのみ更新
 */
export async function updateLinkRequestNote(
  requestId: number,
  staffNote: string
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    await prisma.slpLineLinkRequest.update({
      where: { id: requestId },
      data: { staffNote },
    });
    revalidatePath("/slp/members");
    return ok();
  } catch (e) {
    console.error("[updateLinkRequestNote] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 組合員候補検索（手動紐付けモーダル用）
 * 名前 / メアド / id の部分一致、上限50件
 */
export async function searchMemberCandidates(
  query: string
): Promise<
  ActionResult<
    {
      id: number;
      name: string;
      email: string | null;
      status: string | null;
      uid: string;
    }[]
  >
> {
  await requireStaffWithProjectPermission([{ project: "slp", level: "edit" }]);
  try {
    const trimmed = query.trim();
    const numericId = /^\d+$/.test(trimmed) ? Number(trimmed) : null;

    const members = await prisma.slpMember.findMany({
      where: {
        deletedAt: null,
        ...(trimmed
          ? {
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
                ...(numericId !== null ? [{ id: numericId }] : []),
              ],
            }
          : {}),
      },
      select: { id: true, name: true, email: true, status: true, uid: true },
      orderBy: { id: "desc" },
      take: 50,
    });
    return ok(members);
  } catch (e) {
    console.error("[searchMemberCandidates] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
