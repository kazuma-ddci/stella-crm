import { prisma } from "@/lib/prisma";
import type { Prisma, SlpMeetingSession } from "@prisma/client";

export type SessionCategory = "briefing" | "consultation";
export type SessionStatus = "未予約" | "予約中" | "完了" | "キャンセル" | "飛び";
export type SessionSource = "proline" | "manual";

export const SESSION_CATEGORIES: readonly SessionCategory[] = ["briefing", "consultation"] as const;
export const SESSION_STATUSES: readonly SessionStatus[] = ["未予約", "予約中", "完了", "キャンセル", "飛び"] as const;
export const SESSION_SOURCES: readonly SessionSource[] = ["proline", "manual"] as const;

/**
 * 「試行中」= 未予約 or 予約中（次ラウンドへ進んでいない状態）
 */
export const ACTIVE_STATUSES: readonly SessionStatus[] = ["未予約", "予約中"] as const;

/**
 * 「終了」= 完了 / キャンセル / 飛び（ラウンドの試行が終わった状態）
 */
export const TERMINAL_STATUSES: readonly SessionStatus[] = ["完了", "キャンセル", "飛び"] as const;

/**
 * 完了したセッションの最大 roundNumber を取得（そのカテゴリ内で何回完了しているか）
 * 返り値が N のとき、次に作る新ラウンドは N+1
 */
export async function getMaxCompletedRound(
  companyRecordId: number,
  category: SessionCategory,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const latest = await tx.slpMeetingSession.findFirst({
    where: {
      companyRecordId,
      category,
      status: "完了",
      deletedAt: null,
    },
    orderBy: { roundNumber: "desc" },
    select: { roundNumber: true },
  });
  return latest?.roundNumber ?? 0;
}

/**
 * 現在「試行中」（未予約 or 予約中）のセッションを取得
 * 並列禁止ルール上、通常は1つ or 0つ。複数ある場合は重複検知対象。
 */
export async function getActiveSessions(
  companyRecordId: number,
  category: SessionCategory,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SlpMeetingSession[]> {
  return tx.slpMeetingSession.findMany({
    where: {
      companyRecordId,
      category,
      status: { in: ["未予約", "予約中"] },
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 新規セッション作成時の roundNumber を計算する
 *
 * ルール:
 * - 試行中セッションが存在する → そのセッションと同じ roundNumber（並行試行）
 * - 試行中セッションが無い → maxCompletedRound + 1
 */
export async function calcNextRoundNumber(
  companyRecordId: number,
  category: SessionCategory,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const activeSessions = await getActiveSessions(companyRecordId, category, tx);
  if (activeSessions.length > 0) {
    const maxActiveRound = Math.max(...activeSessions.map(s => s.roundNumber));
    return maxActiveRound;
  }
  const maxCompleted = await getMaxCompletedRound(companyRecordId, category, tx);
  return maxCompleted + 1;
}

/**
 * 未予約セッションを探す（webhook受信時の紐付け用）
 * 同一 companyRecordId × category で status="未予約" の最新1件
 */
export async function findPendingSessionForPromote(
  companyRecordId: number,
  category: SessionCategory,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SlpMeetingSession | null> {
  return tx.slpMeetingSession.findFirst({
    where: {
      companyRecordId,
      category,
      status: "未予約",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 予約IDからセッションを探す（変更/キャンセルwebhook用）
 */
export async function findSessionByProlineReservationId(
  prolineReservationId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SlpMeetingSession | null> {
  return tx.slpMeetingSession.findFirst({
    where: {
      prolineReservationId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 重複検知: 同カテゴリに「試行中」セッションが2件以上存在するか
 */
export async function detectDuplicateActiveSessions(
  companyRecordId: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ briefing: number; consultation: number }> {
  const grouped = await tx.slpMeetingSession.groupBy({
    by: ["category"],
    where: {
      companyRecordId,
      status: { in: ["未予約", "予約中"] },
      deletedAt: null,
    },
    _count: { _all: true },
  });
  const result = { briefing: 0, consultation: 0 };
  for (const g of grouped) {
    if (g.category === "briefing") result.briefing = g._count._all;
    else if (g.category === "consultation") result.consultation = g._count._all;
  }
  return result;
}

/**
 * 飛び回数取得（企業詳細の警告バッジ用）
 */
export async function getNoShowCount(
  companyRecordId: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  return tx.slpMeetingSession.count({
    where: {
      companyRecordId,
      status: "飛び",
      deletedAt: null,
    },
  });
}

/**
 * roundType を返す（通知テンプレート選択用）
 */
export function roundTypeOf(roundNumber: number): "first" | "continuous" {
  return roundNumber === 1 ? "first" : "continuous";
}

/**
 * セッション作成オプション
 */
export interface CreateSessionInput {
  companyRecordId: number;
  category: SessionCategory;
  status: SessionStatus;
  source: SessionSource;
  scheduledAt?: Date | null;
  assignedStaffId?: number | null;
  prolineReservationId?: string | null;
  prolineStaffName?: string | null;
  bookedAt?: Date | null;
  notes?: string | null;
  createdByStaffId?: number | null;
  /** 明示指定された roundNumber。省略時は自動計算 */
  roundNumber?: number;
}

/**
 * セッション作成（履歴記録付き）
 * トランザクション内で実行することを推奨（並列作成時の整合性のため）
 */
export async function createSession(
  input: CreateSessionInput,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession> {
  const roundNumber =
    input.roundNumber ??
    (await calcNextRoundNumber(input.companyRecordId, input.category, tx));

  const session = await tx.slpMeetingSession.create({
    data: {
      companyRecordId: input.companyRecordId,
      category: input.category,
      roundNumber,
      status: input.status,
      source: input.source,
      scheduledAt: input.scheduledAt ?? null,
      assignedStaffId: input.assignedStaffId ?? null,
      prolineReservationId: input.prolineReservationId ?? null,
      prolineStaffName: input.prolineStaffName ?? null,
      bookedAt: input.bookedAt ?? (input.status === "予約中" ? new Date() : null),
      notes: input.notes ?? null,
      createdByStaffId: input.createdByStaffId ?? null,
    },
  });

  await tx.slpMeetingSessionHistory.create({
    data: {
      sessionId: session.id,
      changedByStaffId: input.createdByStaffId ?? null,
      changeType: "created",
      newValue: JSON.stringify({
        status: session.status,
        source: session.source,
        roundNumber: session.roundNumber,
      }),
    },
  });

  return session;
}

/**
 * セッションステータス変更（履歴記録付き）
 * 完了→他ステータスへの変更時は、後続ラウンドがないことを呼び出し側でチェックする
 */
export async function changeSessionStatus(
  sessionId: number,
  newStatus: SessionStatus,
  reason: string,
  changedByStaffId: number | null,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession> {
  const current = await tx.slpMeetingSession.findUnique({ where: { id: sessionId } });
  if (!current) throw new Error(`Session not found: ${sessionId}`);
  if (current.deletedAt) throw new Error(`Session is deleted: ${sessionId}`);

  const now = new Date();
  const updateData: Prisma.SlpMeetingSessionUpdateInput = { status: newStatus };

  // ステータス変更時は、他ステータスの "reason" / "*At" を整合性のためクリアする
  // （旧仕様: 完了に戻した時 canceledAt を null にする、と同等の対応）
  if (newStatus === "完了") {
    updateData.completedAt = now;
    updateData.cancelledAt = null;
    updateData.cancelReason = null;
    updateData.noShowAt = null;
    updateData.noShowReason = null;
  } else if (newStatus === "キャンセル") {
    updateData.cancelledAt = now;
    updateData.cancelReason = reason;
    updateData.completedAt = null;
    updateData.noShowAt = null;
    updateData.noShowReason = null;
  } else if (newStatus === "飛び") {
    updateData.noShowAt = now;
    updateData.noShowReason = reason;
    updateData.completedAt = null;
    updateData.cancelledAt = null;
    updateData.cancelReason = null;
  } else if (newStatus === "予約中") {
    if (current.status === "未予約") {
      updateData.bookedAt = now;
    }
    // 予約中へ巻き戻す場合は他の "完了/キャンセル/飛び" 情報をクリア
    updateData.completedAt = null;
    updateData.cancelledAt = null;
    updateData.cancelReason = null;
    updateData.noShowAt = null;
    updateData.noShowReason = null;
  } else if (newStatus === "未予約") {
    updateData.completedAt = null;
    updateData.cancelledAt = null;
    updateData.cancelReason = null;
    updateData.noShowAt = null;
    updateData.noShowReason = null;
  }

  const updated = await tx.slpMeetingSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  await tx.slpMeetingSessionHistory.create({
    data: {
      sessionId,
      changedByStaffId,
      changeType: "status_change",
      fieldName: "status",
      oldValue: current.status,
      newValue: newStatus,
      reason,
    },
  });

  return updated;
}

/**
 * セッションのフィールド編集（履歴記録付き、複数フィールド対応）
 */
export async function updateSessionFields(
  sessionId: number,
  fields: Partial<{
    bookedAt: Date | null;
    scheduledAt: Date | null;
    assignedStaffId: number | null;
    notes: string | null;
    prolineReservationId: string | null;
  }>,
  reason: string,
  changedByStaffId: number | null,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession> {
  const current = await tx.slpMeetingSession.findUnique({ where: { id: sessionId } });
  if (!current) throw new Error(`Session not found: ${sessionId}`);
  if (current.deletedAt) throw new Error(`Session is deleted: ${sessionId}`);

  const historyEntries: Prisma.SlpMeetingSessionHistoryCreateManyInput[] = [];

  const normalize = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };

  for (const [key, newValue] of Object.entries(fields) as [keyof typeof fields, unknown][]) {
    if (newValue === undefined) continue;
    const oldValue = (current as unknown as Record<string, unknown>)[key];
    const oldNorm = normalize(oldValue);
    const newNorm = normalize(newValue);
    if (oldNorm === newNorm) continue;
    historyEntries.push({
      sessionId,
      changedByStaffId,
      changeType: "field_edit",
      fieldName: key,
      oldValue: oldNorm,
      newValue: newNorm,
      reason,
    });
  }

  const updated = await tx.slpMeetingSession.update({
    where: { id: sessionId },
    data: fields,
  });

  if (historyEntries.length > 0) {
    await tx.slpMeetingSessionHistory.createMany({ data: historyEntries });
  }

  return updated;
}

/**
 * セッション論理削除（履歴記録付き）
 */
export async function softDeleteSession(
  sessionId: number,
  reason: string,
  changedByStaffId: number | null,
  tx: Prisma.TransactionClient
): Promise<void> {
  const current = await tx.slpMeetingSession.findUnique({ where: { id: sessionId } });
  if (!current) throw new Error(`Session not found: ${sessionId}`);
  if (current.deletedAt) return; // 既に削除済み

  await tx.slpMeetingSession.update({
    where: { id: sessionId },
    data: { deletedAt: new Date() },
  });

  await tx.slpMeetingSessionHistory.create({
    data: {
      sessionId,
      changedByStaffId,
      changeType: "deleted",
      reason,
    },
  });
}

/**
 * 後続ラウンドが存在するかチェック（完了→他ステータスへの変更可否判定用）
 */
export async function hasSubsequentRound(
  session: SlpMeetingSession,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const count = await tx.slpMeetingSession.count({
    where: {
      companyRecordId: session.companyRecordId,
      category: session.category,
      roundNumber: { gt: session.roundNumber },
      deletedAt: null,
    },
  });
  return count > 0;
}

// ============================================
// プロラインwebhookからセッションに反映するヘルパー群
// 既存の SlpCompanyRecord カラム更新は別途維持し、ここは並列書き込み担当
// ============================================

interface ProlineReservationParams {
  scheduledAt: Date | null;
  assignedStaffId: number | null;
  prolineReservationId: string | null;
  prolineStaffName: string | null;
  bookedAt: Date | null;
}

/**
 * プロライン予約webhook受信時にセッションを作成/更新する
 *
 * 優先順位:
 * 1. 同prolineReservationIdのセッションが既にある → 冪等性確保（何もしない、既存セッションを返す）
 * 2. 「未予約」セッションがある → 昇格（status="予約中", source="proline"）
 * 3. それ以外 → 新規セッション作成（status="予約中", source="proline"）
 */
export async function applyProlineReservationToSession(
  companyRecordId: number,
  category: SessionCategory,
  params: ProlineReservationParams,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession> {
  // 1. 冪等性チェック
  if (params.prolineReservationId) {
    const existing = await tx.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        prolineReservationId: params.prolineReservationId,
        deletedAt: null,
      },
    });
    if (existing) return existing;
  }

  // 2. 「未予約」昇格
  const pending = await findPendingSessionForPromote(companyRecordId, category, tx);
  if (pending) {
    const updated = await tx.slpMeetingSession.update({
      where: { id: pending.id },
      data: {
        status: "予約中",
        source: "proline",
        scheduledAt: params.scheduledAt,
        assignedStaffId: params.assignedStaffId,
        prolineReservationId: params.prolineReservationId,
        prolineStaffName: params.prolineStaffName,
        bookedAt: params.bookedAt ?? new Date(),
      },
    });
    await tx.slpMeetingSessionHistory.create({
      data: {
        sessionId: pending.id,
        changeType: "status_change",
        fieldName: "status",
        oldValue: "未予約",
        newValue: "予約中",
        reason: "プロラインwebhookにより予約確定",
      },
    });
    return updated;
  }

  // 3. 新規セッション作成
  return createSession(
    {
      companyRecordId,
      category,
      status: "予約中",
      source: "proline",
      scheduledAt: params.scheduledAt,
      assignedStaffId: params.assignedStaffId,
      prolineReservationId: params.prolineReservationId,
      prolineStaffName: params.prolineStaffName,
      bookedAt: params.bookedAt ?? new Date(),
    },
    tx
  );
}

/**
 * プロライン変更webhook受信時にセッションを更新する
 *
 * 優先順位:
 * 1. prolineReservationId でアクティブセッションを探す → あれば更新
 * 2. 「予約中」セッションがあればそれを更新（prolineReservationId変更のケース）
 * 3. 該当セッションがなければ新規作成（移行期の救済処理）
 */
export async function applyProlineChangeToSession(
  companyRecordId: number,
  category: SessionCategory,
  params: ProlineReservationParams,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession> {
  let target: SlpMeetingSession | null = null;

  if (params.prolineReservationId) {
    target = await tx.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        prolineReservationId: params.prolineReservationId,
        deletedAt: null,
      },
    });
  }

  if (!target) {
    target = await tx.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        status: "予約中",
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (target) {
    const updated = await tx.slpMeetingSession.update({
      where: { id: target.id },
      data: {
        status: "予約中",
        source: "proline",
        scheduledAt: params.scheduledAt ?? target.scheduledAt,
        assignedStaffId: params.assignedStaffId ?? target.assignedStaffId,
        prolineReservationId: params.prolineReservationId ?? target.prolineReservationId,
        prolineStaffName: params.prolineStaffName ?? target.prolineStaffName,
        bookedAt: params.bookedAt ?? target.bookedAt,
        cancelledAt: null,
        cancelReason: null,
      },
    });
    await tx.slpMeetingSessionHistory.create({
      data: {
        sessionId: target.id,
        changeType: "field_edit",
        fieldName: "reservation_change",
        oldValue: JSON.stringify({
          scheduledAt: target.scheduledAt,
          assignedStaffId: target.assignedStaffId,
        }),
        newValue: JSON.stringify({
          scheduledAt: params.scheduledAt,
          assignedStaffId: params.assignedStaffId,
        }),
        reason: "プロラインwebhookによる予約変更",
      },
    });
    return updated;
  }

  // セッションが無い場合の救済: 新規作成
  return createSession(
    {
      companyRecordId,
      category,
      status: "予約中",
      source: "proline",
      scheduledAt: params.scheduledAt,
      assignedStaffId: params.assignedStaffId,
      prolineReservationId: params.prolineReservationId,
      prolineStaffName: params.prolineStaffName,
      bookedAt: params.bookedAt ?? new Date(),
    },
    tx
  );
}

/**
 * プロラインキャンセルwebhook受信時にセッションをキャンセル状態に変更
 *
 * 対象セッションが見つからない場合は何もせず null を返す（ログは呼び出し側で）
 */
export async function applyProlineCancelToSession(
  companyRecordId: number,
  category: SessionCategory,
  prolineReservationId: string | null,
  reason: string,
  tx: Prisma.TransactionClient
): Promise<SlpMeetingSession | null> {
  let target: SlpMeetingSession | null = null;

  if (prolineReservationId) {
    target = await tx.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        prolineReservationId,
        deletedAt: null,
      },
    });
  }

  if (!target) {
    target = await tx.slpMeetingSession.findFirst({
      where: {
        companyRecordId,
        category,
        status: { in: ["予約中", "未予約"] },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!target) return null;

  const now = new Date();
  const updated = await tx.slpMeetingSession.update({
    where: { id: target.id },
    data: {
      status: "キャンセル",
      cancelledAt: now,
      cancelReason: reason,
    },
  });
  await tx.slpMeetingSessionHistory.create({
    data: {
      sessionId: target.id,
      changeType: "status_change",
      fieldName: "status",
      oldValue: target.status,
      newValue: "キャンセル",
      reason,
    },
  });
  return updated;
}
