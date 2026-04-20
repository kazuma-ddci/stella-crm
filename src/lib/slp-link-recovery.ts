/**
 * SLP 後追いLINE紐付けロジック（共通ヘルパー）
 *
 * プロライン構築前の既存組合員が、後から公式LINEを友達追加して
 * uidを紐付けるためのフローで使用する。
 *
 * 呼び出し元:
 *   - フォーム送信API (/api/public/slp/member-link)
 *   - cron (/api/cron/slp-line-link-resolve) … pending_friend_sync 再処理
 *   - スタッフ手動紐付けサーバアクション (resolveLinkRequestManually)
 */

import { prisma } from "@/lib/prisma";
import { logAutomationError } from "@/lib/automation-error";

// ====================================================================
// 後追い紐付けビーコンURL
// ====================================================================
const BEACON_URL_SIGNED = "https://autosns.jp/api/call-beacon/D6DJAb2MNC"; // 締結済み: リッチメニュー開放
const BEACON_URL_SENT = "https://autosns.jp/api/call-beacon/G0JqiTyQx9"; // 契約書送付済: 確認案内（リッチメニュー制限のまま）

const BEACON_RETRY_COUNT = 3;
const BEACON_RETRY_DELAY_MS = 5000;

// ====================================================================
// 型定義
// ====================================================================

export type LinkRequestStatus =
  | "pending_friend_sync"
  | "pending_staff_review"
  | "email_not_found"
  | "resolved_auto"
  | "resolved_manual"
  | "rejected";

export type LinkReviewReason =
  | "line_name_mismatch"
  | "email_multiple_match"
  | "uid_already_linked"
  | "member_deleted"
  | "contract_canceled"
  | "status_not_sent"
  | "invalid_data";

export type BeaconType = "signed" | "sent";

export type LinkAttemptOutcome =
  | { kind: "resolved"; memberId: number; status: string; beaconType: BeaconType | null }
  | { kind: "pending_friend_sync" }
  | { kind: "pending_staff_review"; reason: LinkReviewReason; matchedMemberId?: number }
  | { kind: "email_not_found" };

// ====================================================================
// メアド正規化
// ====================================================================
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ====================================================================
// ビーコン呼び出し（5秒×3回リトライ）
// ====================================================================
async function callBeaconWithRetry(beaconBaseUrl: string, uid: string): Promise<void> {
  const url = `${beaconBaseUrl}/${encodeURIComponent(uid)}`;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= BEACON_RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < BEACON_RETRY_COUNT) {
      await new Promise((resolve) => setTimeout(resolve, BEACON_RETRY_DELAY_MS));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}

// ====================================================================
// ステータスからビーコンタイプを決定
// ====================================================================
function beaconTypeFromStatus(status: string | null): BeaconType | null {
  if (status === "組合員契約書締結") return "signed";
  if (status === "契約書送付済") return "sent";
  return null;
}

// ====================================================================
// 紐付け試行コア
//
// 入力:
//   - uid: フォーム送信時のuid（公式LINE友だちのuid想定）
//   - submittedLineName: フォーム送信されたLINE名（不一致検知用）
//   - submittedEmail: フォーム送信されたメールアドレス（正規化済み）
//   - source: "form" | "cron" | "staff_manual"
//   - forcedMemberId: スタッフ手動紐付け時のみ指定（メアド検索をスキップ）
//
// 戻り値: 次にユーザー画面・スタッフ画面に出すべき結果
// ====================================================================
export async function attemptLineLink(params: {
  uid: string;
  submittedLineName: string | null;
  submittedEmail: string;
  source: "form" | "cron" | "staff_manual";
  forcedMemberId?: number;
}): Promise<LinkAttemptOutcome> {
  const { uid, submittedLineName, submittedEmail, source, forcedMemberId } = params;

  // 公式LINE友達情報を取得
  const lineFriend = await prisma.slpLineFriend.findUnique({
    where: { uid },
    select: { uid: true, snsname: true },
  });
  const friendSnsname = lineFriend?.snsname ?? null;

  // ================================================================
  // スタッフ手動パス（forcedMemberId 必須、メアド/LINE名照合スキップ）
  // ================================================================
  if (source === "staff_manual") {
    if (!forcedMemberId) {
      throw new Error("forcedMemberId is required for staff_manual source");
    }
    const member = await prisma.slpMember.findUnique({
      where: { id: forcedMemberId },
      select: { id: true, uid: true, email: true, status: true, deletedAt: true },
    });
    if (!member || member.deletedAt) {
      throw new Error("指定された組合員が見つからないか、削除済みです");
    }

    const beaconType = beaconTypeFromStatus(member.status);

    await applyMemberLink(member.id, uid, friendSnsname ?? submittedLineName);
    if (beaconType) {
      await fireBeaconSafe(member.id, uid, beaconType);
    }
    return {
      kind: "resolved",
      memberId: member.id,
      status: member.status ?? "",
      beaconType,
    };
  }

  // ================================================================
  // 自動パス（form / cron）
  // ================================================================

  // 1. SlpLineFriend 未着 → 同期待ち
  if (!lineFriend) {
    return { kind: "pending_friend_sync" };
  }

  // 2. メアドで組合員特定（大文字小文字無視）
  //    - 0件    → email_not_found（ユーザー向けメッセージ）
  //    - 2件以上 → pending_staff_review
  const candidates = await prisma.slpMember.findMany({
    where: {
      email: { equals: submittedEmail, mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true, uid: true, email: true, status: true, deletedAt: true },
  });

  if (candidates.length === 0) {
    return { kind: "email_not_found" };
  }
  if (candidates.length > 1) {
    return { kind: "pending_staff_review", reason: "email_multiple_match" };
  }

  const member = candidates[0];

  // 3. LINE名照合（友だち情報と送信値の比較）
  //    メアド一致した後に判定（メアド未発見のほうがユーザーに対応しやすいため）
  if (
    friendSnsname &&
    submittedLineName &&
    friendSnsname.trim().length > 0 &&
    submittedLineName.trim().length > 0 &&
    friendSnsname.trim() !== submittedLineName.trim()
  ) {
    return {
      kind: "pending_staff_review",
      reason: "line_name_mismatch",
      matchedMemberId: member.id,
    };
  }

  // 4. 既に別のLINEに紐付いていないか確認
  //    プロライン構築前の組合員は、SlpLineFriend に存在しないプレースホルダー
  //    uid を持っている場合がある。現在の member.uid が実在する SlpLineFriend
  //    を指している場合のみ「既に別LINEで紐付け済み」とみなす。
  if (member.uid !== uid) {
    const existingFriendForMember = await prisma.slpLineFriend.findUnique({
      where: { uid: member.uid },
      select: { uid: true },
    });
    if (existingFriendForMember) {
      return {
        kind: "pending_staff_review",
        reason: "uid_already_linked",
        matchedMemberId: member.id,
      };
    }
    // 既存uidが友達情報に無い = プレースホルダ → 上書きOK
  }

  // 5. ステータス判定
  //    契約破棄 / 未送付 / 送付エラー は「紐付けはするがスタッフ確認待ち」
  //    （ビーコンは発火しない）
  if (member.status === "契約破棄") {
    await applyMemberLink(member.id, uid, friendSnsname ?? submittedLineName);
    return {
      kind: "pending_staff_review",
      reason: "contract_canceled",
      matchedMemberId: member.id,
    };
  }
  if (member.status === "契約書未送付" || member.status === "送付エラー") {
    await applyMemberLink(member.id, uid, friendSnsname ?? submittedLineName);
    return {
      kind: "pending_staff_review",
      reason: "status_not_sent",
      matchedMemberId: member.id,
    };
  }

  // 無効データ: 紐付けは実行するが、スタッフ確認に振る（ビーコンは呼ばない）
  if (member.status === "無効データ") {
    await applyMemberLink(member.id, uid, friendSnsname ?? submittedLineName);
    return {
      kind: "pending_staff_review",
      reason: "invalid_data",
      matchedMemberId: member.id,
    };
  }

  // 6. 締結済み / 送付済み → 紐付け＋ビーコン発火
  const beaconType = beaconTypeFromStatus(member.status);
  await applyMemberLink(member.id, uid, friendSnsname ?? submittedLineName);
  if (beaconType) {
    await fireBeaconSafe(member.id, uid, beaconType);
  }

  return {
    kind: "resolved",
    memberId: member.id,
    status: member.status ?? "",
    beaconType,
  };
}

// ====================================================================
// SlpMember の uid + lineName を上書き
// ====================================================================
async function applyMemberLink(
  memberId: number,
  newUid: string,
  newLineName: string | null
): Promise<void> {
  // 他組合員が既に同uidを持っていないか確認
  const conflict = await prisma.slpMember.findUnique({
    where: { uid: newUid },
    select: { id: true },
  });
  if (conflict && conflict.id !== memberId) {
    throw new Error(`uid衝突: 既に他組合員に紐付いています (uid=${newUid})`);
  }

  await prisma.slpMember.update({
    where: { id: memberId },
    data: {
      uid: newUid,
      lineName: newLineName ?? undefined,
    },
  });
}

// ====================================================================
// ビーコン発火（エラーは logAutomationError に記録して握り潰す）
//
// 理由:
//   - ビーコンが失敗して throw すると、applyMemberLink は成功済みなので
//     SlpLineLinkRequest が更新されないまま無限リトライになる
//   - ビーコン失敗はログで検知できるため、呼び出し元には成功扱いで返す
// ====================================================================
async function fireBeaconSafe(
  memberId: number,
  uid: string,
  beaconType: BeaconType
): Promise<void> {
  try {
    await fireBeaconAndMarkFlag(memberId, uid, beaconType);
  } catch (err) {
    console.error(
      `[slp-link-recovery] Beacon failed (swallowed). memberId=${memberId}, uid=${uid}, type=${beaconType}`,
      err
    );
  }
}

// ====================================================================
// ビーコン発火 + 二重発火防止フラグの更新
// ====================================================================
async function fireBeaconAndMarkFlag(
  memberId: number,
  uid: string,
  beaconType: BeaconType
): Promise<void> {
  const member = await prisma.slpMember.findUnique({
    where: { id: memberId },
    select: { richmenuBeaconCalled: true, postLinkSentBeaconCalled: true },
  });
  if (!member) return;

  // 二重発火防止
  if (beaconType === "signed" && member.richmenuBeaconCalled) return;
  if (beaconType === "sent" && member.postLinkSentBeaconCalled) return;

  const url = beaconType === "signed" ? BEACON_URL_SIGNED : BEACON_URL_SENT;
  try {
    await callBeaconWithRetry(url, uid);
    if (beaconType === "signed") {
      await prisma.slpMember.update({
        where: { id: memberId },
        data: { richmenuBeaconCalled: true },
      });
    } else {
      await prisma.slpMember.update({
        where: { id: memberId },
        data: { postLinkSentBeaconCalled: true },
      });
    }
  } catch (err) {
    await logAutomationError({
      source: "slp-link-recovery/beacon",
      message: `後追い紐付けビーコン発火失敗 (uid=${uid}, type=${beaconType})`,
      detail: {
        memberId,
        uid,
        beaconType,
        url,
        error: err instanceof Error ? err.message : String(err),
        retryAction: "slp-link-recovery-beacon",
      },
    });
    throw err;
  }
}

// ====================================================================
// スタッフ手動の uid/ステータス変更に伴うビーコン発火
//
// 呼び出し元:
//   - relinkMemberLineFriend（組合員詳細の「LINE紐付けの確認・修正」）
//   - updateMember（組合員テーブルの uid / status 編集）
//
// 挙動:
//   - 現在の uid が空なら何もしない
//   - 現在の status が beaconTypeFromStatus で null なら何もしない
//   - uidChanged=true なら richmenuBeaconCalled / postLinkSentBeaconCalled
//     を両方 false にリセット（別LINEに付け替え扱い）してから発火
//   - uidChanged=false（ステータス変更のみ）はフラグを尊重して発火
// ====================================================================
export async function triggerLinkBeaconForStaff(params: {
  memberId: number;
  uidChanged: boolean;
}): Promise<void> {
  const member = await prisma.slpMember.findUnique({
    where: { id: params.memberId },
    select: { id: true, uid: true, status: true },
  });
  if (!member) return;
  if (!member.uid) return;

  const beaconType = beaconTypeFromStatus(member.status);
  if (!beaconType) return;

  if (params.uidChanged) {
    await prisma.slpMember.update({
      where: { id: params.memberId },
      data: {
        richmenuBeaconCalled: false,
        postLinkSentBeaconCalled: false,
      },
    });
  }

  await fireBeaconSafe(params.memberId, member.uid, beaconType);
}

// ====================================================================
// SlpLineLinkRequest を outcome に基づいて upsert
// ====================================================================
export async function persistLinkRequestOutcome(params: {
  uid: string;
  submittedLineName: string | null;
  submittedEmail: string;
  outcome: LinkAttemptOutcome;
  source: "form" | "cron" | "staff_manual";
  resolvedByStaffId?: number;
  staffNote?: string;
}): Promise<{ requestId: number }> {
  const { uid, submittedLineName, submittedEmail, outcome, source, resolvedByStaffId, staffNote } =
    params;

  let status: LinkRequestStatus;
  let reviewReason: LinkReviewReason | null = null;
  let resolvedMemberId: number | null = null;
  let resolvedAt: Date | null = null;
  let beaconType: BeaconType | null = null;
  let beaconCalledAt: Date | null = null;

  switch (outcome.kind) {
    case "resolved":
      status = source === "staff_manual" ? "resolved_manual" : "resolved_auto";
      resolvedMemberId = outcome.memberId;
      resolvedAt = new Date();
      beaconType = outcome.beaconType;
      beaconCalledAt = outcome.beaconType ? new Date() : null;
      break;
    case "pending_friend_sync":
      status = "pending_friend_sync";
      break;
    case "pending_staff_review":
      status = "pending_staff_review";
      reviewReason = outcome.reason;
      resolvedMemberId = outcome.matchedMemberId ?? null;
      break;
    case "email_not_found":
      status = "email_not_found";
      break;
  }

  const updateData = {
    status,
    reviewReason,
    resolvedMemberId,
    resolvedAt,
    resolvedByStaffId: resolvedByStaffId ?? null,
    beaconType,
    beaconCalledAt,
    ...(staffNote !== undefined ? { staffNote } : {}),
  };

  const result = await prisma.slpLineLinkRequest.upsert({
    where: { uid },
    create: {
      uid,
      submittedLineName,
      submittedEmail,
      ...updateData,
    },
    update: updateData,
    select: { id: true },
  });

  return { requestId: result.id };
}

// ====================================================================
// LinkAttemptOutcome をユーザー画面向けの type 文字列に変換
//   - フォームAPI / プリフィルAPI で共通利用
// ====================================================================
export function outcomeToResponseType(
  outcome: LinkAttemptOutcome
): string {
  switch (outcome.kind) {
    case "resolved":
      if (outcome.beaconType === "signed") return "resolved_signed";
      if (outcome.beaconType === "sent") return "resolved_sent";
      return "resolved_pending";
    case "pending_friend_sync":
      return "pending_friend_sync";
    case "pending_staff_review":
      return "pending_staff_review";
    case "email_not_found":
      return "email_not_found";
  }
}

/**
 * 保存済み SlpLineLinkRequest のステータスを user-facing の type に変換
 *   - resolved_auto + beaconType=signed → resolved_signed
 *   - resolved_auto + beaconType=sent → resolved_sent
 *   - resolved_*     + beaconType=null → resolved_pending
 *   - 他             → そのままのステータス名
 */
export function persistedStatusToResponseType(
  status: string,
  beaconType: string | null
): string {
  switch (status) {
    case "resolved_auto":
    case "resolved_manual":
      if (beaconType === "signed") return "resolved_signed";
      if (beaconType === "sent") return "resolved_sent";
      return "resolved_pending";
    case "pending_friend_sync":
    case "pending_staff_review":
    case "email_not_found":
    case "rejected":
      return status;
    default:
      return "pending_staff_review";
  }
}
