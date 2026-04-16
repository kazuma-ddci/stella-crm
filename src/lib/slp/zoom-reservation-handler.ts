import { prisma } from "@/lib/prisma";
import {
  createZoomMeeting,
  updateZoomMeeting,
  deleteZoomMeeting,
} from "@/lib/zoom/meeting";
import { logAutomationError } from "@/lib/automation-error";
import { sendZoomMessageViaProline } from "./zoom-proline-sender";
import type { ZoomCategory } from "./zoom-proline-sender";

type RecordFields = {
  id: number;
  prolineUid: string | null;
  companyName: string | null;
  briefingDate: Date | null;
  briefingStaffId: number | null;
  briefingStaff: string | null;
  briefingZoomMeetingId: bigint | null;
  briefingZoomHostStaffId: number | null;
  briefingZoomJoinUrl: string | null;
  briefingZoomStartUrl: string | null;
  briefingZoomPassword: string | null;
  briefingZoomConfirmSentAt: Date | null;
  consultationDate: Date | null;
  consultationStaffId: number | null;
  consultationStaff: string | null;
  consultationZoomMeetingId: bigint | null;
  consultationZoomHostStaffId: number | null;
  consultationZoomJoinUrl: string | null;
  consultationZoomStartUrl: string | null;
  consultationZoomPassword: string | null;
  consultationZoomConfirmSentAt: Date | null;
};

async function loadRecord(id: number): Promise<RecordFields | null> {
  const r = await prisma.slpCompanyRecord.findUnique({
    where: { id },
    select: {
      id: true,
      prolineUid: true,
      companyName: true,
      briefingDate: true,
      briefingStaffId: true,
      briefingStaff: true,
      briefingZoomMeetingId: true,
      briefingZoomHostStaffId: true,
      briefingZoomJoinUrl: true,
      briefingZoomStartUrl: true,
      briefingZoomPassword: true,
      briefingZoomConfirmSentAt: true,
      consultationDate: true,
      consultationStaffId: true,
      consultationStaff: true,
      consultationZoomMeetingId: true,
      consultationZoomHostStaffId: true,
      consultationZoomJoinUrl: true,
      consultationZoomStartUrl: true,
      consultationZoomPassword: true,
      consultationZoomConfirmSentAt: true,
    },
  });
  return r as RecordFields | null;
}

async function loadStaffName(staffId: number): Promise<string | null> {
  const s = await prisma.masterStaff.findUnique({
    where: { id: staffId },
    select: { name: true },
  });
  return s?.name ?? null;
}

function categoryCol(category: ZoomCategory) {
  const prefix = category;
  return {
    zoomMeetingIdKey: `${prefix}ZoomMeetingId` as const,
    zoomJoinUrlKey: `${prefix}ZoomJoinUrl` as const,
    zoomStartUrlKey: `${prefix}ZoomStartUrl` as const,
    zoomPasswordKey: `${prefix}ZoomPassword` as const,
    zoomHostStaffIdKey: `${prefix}ZoomHostStaffId` as const,
    zoomCreatedAtKey: `${prefix}ZoomCreatedAt` as const,
    zoomErrorKey: `${prefix}ZoomError` as const,
    zoomErrorAtKey: `${prefix}ZoomErrorAt` as const,
    zoomConfirmSentAtKey: `${prefix}ZoomConfirmSentAt` as const,
    zoomRemindDaySentAtKey: `${prefix}ZoomRemindDaySentAt` as const,
    zoomRemindHourSentAtKey: `${prefix}ZoomRemindHourSentAt` as const,
    dateKey: `${prefix}Date` as const,
    staffIdKey: `${prefix}StaffId` as const,
  };
}

/**
 * 予約確定/変更/担当者変更時のZoom会議発行フロー。
 * - 担当者・日時が揃っていなければ何もしない（発行不可）
 * - 既存 meeting があり担当者変更 or 日時変更あり → 適切にUPDATE or DELETE+CREATE
 * - 発行成功 → DB更新 + お客様LINEへURL案内送信
 * - 発行失敗 → エラーDB保存 + automation_errors記録
 *
 * category: "briefing" or "consultation"
 * triggerReason: "confirm" | "change" — 送信メッセージ種別決定用
 */
export async function ensureZoomMeetingForReservation(params: {
  companyRecordId: number;
  category: ZoomCategory;
  triggerReason: "confirm" | "change";
}): Promise<void> {
  const record = await loadRecord(params.companyRecordId);
  if (!record) return;
  const cols = categoryCol(params.category);

  const currentStaffId = record[cols.staffIdKey] as number | null;
  const currentDate = record[cols.dateKey] as Date | null;
  const currentMeetingId = record[cols.zoomMeetingIdKey] as bigint | null;
  const currentHostStaffId = record[cols.zoomHostStaffIdKey] as number | null;

  const topicCompanyName = record.companyName ?? "（企業名未設定）";
  const categoryJp =
    params.category === "briefing" ? "概要案内" : "導入希望商談";
  const topic = `${topicCompanyName}様 ${categoryJp}`;

  // 発行不可条件
  if (!currentStaffId || !currentDate) {
    await saveZoomError(
      params.companyRecordId,
      params.category,
      "担当者または日時が未設定のためZoom発行できません"
    );
    return;
  }

  try {
    let newMeetingId: bigint;
    let newJoinUrl: string;
    let newStartUrl: string | null = null;
    let newPassword: string | null = null;

    if (!currentMeetingId) {
      // 初回発行
      const resp = await createZoomMeeting({
        hostStaffId: currentStaffId,
        topic,
        startAtJst: currentDate,
        durationMinutes: 60,
      });
      newMeetingId = BigInt(resp.id);
      newJoinUrl = resp.join_url;
      newStartUrl = resp.start_url ?? null;
      newPassword = resp.password ?? null;
    } else {
      // 既存meetingあり
      const hostChanged = currentHostStaffId !== currentStaffId;
      if (hostChanged) {
        // 担当者変更 → 旧Zoomを削除して新Zoomを作成（Zoomはホスト変更APIがないため）
        if (currentHostStaffId) {
          try {
            await deleteZoomMeeting({
              hostStaffId: currentHostStaffId,
              meetingId: currentMeetingId,
            });
          } catch (err) {
            await logAutomationError({
              source: "slp-zoom-delete-on-host-change",
              message: "担当者変更時の旧Zoom削除失敗（続行）",
              detail: {
                companyRecordId: params.companyRecordId,
                category: params.category,
                error: err instanceof Error ? err.message : String(err),
              },
            });
          }
        }
        const resp = await createZoomMeeting({
          hostStaffId: currentStaffId,
          topic,
          startAtJst: currentDate,
          durationMinutes: 60,
        });
        newMeetingId = BigInt(resp.id);
        newJoinUrl = resp.join_url;
        newStartUrl = resp.start_url ?? null;
        newPassword = resp.password ?? null;
      } else {
        // 日時やタイトルだけの更新 → update API（URL/パスワードは不変）
        await updateZoomMeeting({
          hostStaffId: currentStaffId,
          meetingId: currentMeetingId,
          topic,
          startAtJst: currentDate,
          durationMinutes: 60,
        });
        // URL・meetingId・start_url・password は既存値を保持
        newMeetingId = currentMeetingId;
        newJoinUrl = (record[cols.zoomJoinUrlKey] as string | null) ?? "";
        newStartUrl = record[cols.zoomStartUrlKey] as string | null;
        newPassword = record[cols.zoomPasswordKey] as string | null;
      }
    }

    // DB更新（update パスでは zoomCreatedAt を触らない・既存値を保つ）
    const isNewMeeting = !currentMeetingId;
    const updateData: Record<string, unknown> = {
      [cols.zoomMeetingIdKey]: newMeetingId,
      [cols.zoomJoinUrlKey]: newJoinUrl,
      [cols.zoomStartUrlKey]: newStartUrl,
      [cols.zoomPasswordKey]: newPassword,
      [cols.zoomHostStaffIdKey]: currentStaffId,
      [cols.zoomErrorKey]: null,
      [cols.zoomErrorAtKey]: null,
      ...(isNewMeeting ? { [cols.zoomCreatedAtKey]: new Date() } : {}),
    };
    await prisma.slpCompanyRecord.update({
      where: { id: params.companyRecordId },
      data: updateData,
    });

    // お客様LINE送信（プロラインUIDがあれば）
    if (record.prolineUid) {
      const staffName = await loadStaffName(currentStaffId);
      const trigger =
        params.triggerReason === "confirm" ? "confirm" : "change";
      const sendResult = await sendZoomMessageViaProline({
        companyRecordId: params.companyRecordId,
        uid: record.prolineUid,
        category: params.category,
        trigger,
        ctx: {
          companyName: record.companyName,
          staffName,
          dateJst: currentDate,
          url: newJoinUrl,
        },
      });
      if (sendResult.ok && trigger === "confirm") {
        await prisma.slpCompanyRecord.update({
          where: { id: params.companyRecordId },
          data: {
            [cols.zoomConfirmSentAtKey]: new Date(),
          },
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await saveZoomError(params.companyRecordId, params.category, msg);
    await logAutomationError({
      source: `slp-zoom-${params.category}-${params.triggerReason}`,
      message: `Zoom発行失敗: ${msg}`,
      detail: {
        companyRecordId: params.companyRecordId,
        staffId: currentStaffId,
        date: currentDate?.toISOString(),
      },
    });

    // Zoom作成失敗時でもURL未発行用テンプレートで通知を送信
    if (record.prolineUid && currentStaffId) {
      const staffName = await loadStaffName(currentStaffId);
      const noUrlTrigger =
        params.triggerReason === "confirm"
          ? ("confirm_no_url" as const)
          : ("change_no_url" as const);
      try {
        await sendZoomMessageViaProline({
          companyRecordId: params.companyRecordId,
          uid: record.prolineUid,
          category: params.category,
          trigger: noUrlTrigger,
          ctx: {
            companyName: record.companyName,
            staffName,
            dateJst: currentDate,
            url: null,
          },
        });
      } catch (sendErr) {
        await logAutomationError({
          source: `slp-zoom-${params.category}-no-url-fallback`,
          message: `URL未発行通知の送信も失敗`,
          detail: {
            companyRecordId: params.companyRecordId,
            error:
              sendErr instanceof Error ? sendErr.message : String(sendErr),
          },
        });
      }
    }
  }
}

/**
 * キャンセル時: 既存Zoom会議を削除してDBをクリア。
 */
export async function cancelZoomMeetingForReservation(params: {
  companyRecordId: number;
  category: ZoomCategory;
}): Promise<void> {
  const record = await loadRecord(params.companyRecordId);
  if (!record) return;
  const cols = categoryCol(params.category);
  const currentMeetingId = record[cols.zoomMeetingIdKey] as bigint | null;
  const currentHostStaffId = record[cols.zoomHostStaffIdKey] as number | null;

  if (currentMeetingId && currentHostStaffId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: currentHostStaffId,
        meetingId: currentMeetingId,
      });
    } catch (err) {
      await logAutomationError({
        source: `slp-zoom-${params.category}-cancel-delete`,
        message: "Zoom会議削除失敗（続行・DBは初期化）",
        detail: {
          companyRecordId: params.companyRecordId,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  await prisma.slpCompanyRecord.update({
    where: { id: params.companyRecordId },
    data: {
      [cols.zoomMeetingIdKey]: null,
      [cols.zoomJoinUrlKey]: null,
      [cols.zoomStartUrlKey]: null,
      [cols.zoomPasswordKey]: null,
      [cols.zoomHostStaffIdKey]: null,
      [cols.zoomCreatedAtKey]: null,
      [cols.zoomErrorKey]: null,
      [cols.zoomErrorAtKey]: null,
      [cols.zoomConfirmSentAtKey]: null,
      [cols.zoomRemindDaySentAtKey]: null,
      [cols.zoomRemindHourSentAtKey]: null,
    },
  });
}

async function saveZoomError(
  companyRecordId: number,
  category: ZoomCategory,
  errorMsg: string
): Promise<void> {
  const cols = categoryCol(category);
  await prisma.slpCompanyRecord.update({
    where: { id: companyRecordId },
    data: {
      [cols.zoomErrorKey]: errorMsg.slice(0, 2000),
      [cols.zoomErrorAtKey]: new Date(),
    },
  });
}

/**
 * 商談タブからスタッフが「再発行」ボタンを押した時用（権限チェックは呼び出し側）
 * 既存meetingIdをクリアして強制的に作り直す。
 */
export async function regenerateZoomForReservation(params: {
  companyRecordId: number;
  category: ZoomCategory;
}): Promise<{ ok: boolean; url: string | null; errorMessage?: string }> {
  const cols = categoryCol(params.category);
  // 既存のmeetingId/hostをクリア（→ 初回発行として扱う）
  // ただし既存Zoomがあるなら先に削除を試みる
  const record = await loadRecord(params.companyRecordId);
  if (!record) return { ok: false, url: null, errorMessage: "レコードなし" };
  const currentMeetingId = record[cols.zoomMeetingIdKey] as bigint | null;
  const currentHostStaffId = record[cols.zoomHostStaffIdKey] as number | null;
  if (currentMeetingId && currentHostStaffId) {
    try {
      await deleteZoomMeeting({
        hostStaffId: currentHostStaffId,
        meetingId: currentMeetingId,
      });
    } catch {
      // ignore
    }
  }
  await prisma.slpCompanyRecord.update({
    where: { id: params.companyRecordId },
    data: {
      [cols.zoomMeetingIdKey]: null,
      [cols.zoomJoinUrlKey]: null,
      [cols.zoomStartUrlKey]: null,
      [cols.zoomPasswordKey]: null,
      [cols.zoomHostStaffIdKey]: null,
      [cols.zoomCreatedAtKey]: null,
      [cols.zoomErrorKey]: null,
      [cols.zoomErrorAtKey]: null,
    },
  });

  // 再作成（送信まで走らせない — 再発行時はスタッフが手動で送付する仕様）
  try {
    const record2 = await loadRecord(params.companyRecordId);
    if (!record2) return { ok: false, url: null, errorMessage: "レコードなし" };
    const staffId = record2[cols.staffIdKey] as number | null;
    const date = record2[cols.dateKey] as Date | null;
    if (!staffId || !date) {
      return {
        ok: false,
        url: null,
        errorMessage: "担当者または日時が未設定です",
      };
    }
    const topic = `${record2.companyName ?? "（企業名未設定）"}様 ${
      params.category === "briefing" ? "概要案内" : "導入希望商談"
    }`;
    const resp = await createZoomMeeting({
      hostStaffId: staffId,
      topic,
      startAtJst: date,
      durationMinutes: 60,
    });

    await prisma.slpCompanyRecord.update({
      where: { id: params.companyRecordId },
      data: {
        [cols.zoomMeetingIdKey]: BigInt(resp.id),
        [cols.zoomJoinUrlKey]: resp.join_url,
        [cols.zoomStartUrlKey]: resp.start_url ?? null,
        [cols.zoomPasswordKey]: resp.password ?? null,
        [cols.zoomHostStaffIdKey]: staffId,
        [cols.zoomCreatedAtKey]: new Date(),
        // 再発行なので自動送信フラグはリセットしない（既に送信済みの履歴を尊重）
      },
    });
    return { ok: true, url: resp.join_url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await saveZoomError(params.companyRecordId, params.category, msg);
    await logAutomationError({
      source: `slp-zoom-${params.category}-regenerate`,
      message: `Zoom再発行失敗: ${msg}`,
      detail: { companyRecordId: params.companyRecordId },
    });
    return { ok: false, url: null, errorMessage: msg };
  }
}
