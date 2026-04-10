"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { openRichMenuForFriend } from "@/lib/proline-form";
import { logAutomationError } from "@/lib/automation-error";
import { ok, err, type ActionResult } from "@/lib/action-result";

export async function addLineFriend(
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const uid = String(data.uid ?? "").trim();
    if (!uid) return err("UIDは必須です");

    const existing = await prisma.slpLineFriend.findUnique({ where: { uid } });
    if (existing) return err(`UID「${uid}」は既に使用されています`);

    await prisma.slpLineFriend.create({
      data: {
        snsname: data.snsname ? String(data.snsname).trim() : null,
        password: data.password ? String(data.password).trim() : null,
        emailLine: data.emailLine ? String(data.emailLine).trim() : null,
        emailRenkei: data.emailRenkei ? String(data.emailRenkei).trim() : null,
        emailLine2: data.emailLine2 ? String(data.emailLine2).trim() : null,
        email: data.email ? String(data.email).trim() : null,
        uid,
        friendAddedDate: data.friendAddedDate ? new Date(String(data.friendAddedDate)) : null,
        activeStatus: data.activeStatus ? String(data.activeStatus) : null,
        lastActivityDate: data.lastActivityDate ? String(data.lastActivityDate).trim() : null,
        sei: data.sei ? String(data.sei).trim() : null,
        mei: data.mei ? String(data.mei).trim() : null,
        nickname: data.nickname ? String(data.nickname).trim() : null,
        phone: data.phone ? String(data.phone).trim() : null,
        postcode: data.postcode ? String(data.postcode).trim() : null,
        address1: data.address1 ? String(data.address1).trim() : null,
        address2: data.address2 ? String(data.address2).trim() : null,
        address3: data.address3 ? String(data.address3).trim() : null,
        nenrei: data.nenrei ? String(data.nenrei).trim() : null,
        nendai: data.nendai ? String(data.nendai).trim() : null,
        seibetu: data.seibetu ? String(data.seibetu).trim() : null,
        free1: data.free1 ? String(data.free1).trim() : null,
        free2: data.free2 ? String(data.free2).trim() : null,
        free3: data.free3 ? String(data.free3).trim() : null,
        free4: data.free4 ? String(data.free4).trim() : null,
        free5: data.free5 ? String(data.free5).trim() : null,
        free6: data.free6 ? String(data.free6).trim() : null,
        scenarioPos1: data.scenarioPos1 ? String(data.scenarioPos1).trim() : null,
        scenarioPos2: data.scenarioPos2 ? String(data.scenarioPos2).trim() : null,
        scenarioPos3: data.scenarioPos3 ? String(data.scenarioPos3).trim() : null,
        scenarioPos4: data.scenarioPos4 ? String(data.scenarioPos4).trim() : null,
        scenarioPos5: data.scenarioPos5 ? String(data.scenarioPos5).trim() : null,
        // CRM画面からの手動追加は編集・削除可能フラグを立てる
        isManuallyAdded: true,
      },
    });

    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[addLineFriend] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateLineFriend(
  id: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    // 編集可否チェック（プロライン由来は不可）
    const current = await prisma.slpLineFriend.findUnique({
      where: { id },
      select: { uid: true, isManuallyAdded: true },
    });
    if (!current) return err("LINE友達が見つかりません");
    if (!current.isManuallyAdded) {
      return err("プロライン由来のデータは編集できません");
    }

    const updateData: Record<string, unknown> = {};

    const stringFields = [
      "snsname", "password", "emailLine", "emailRenkei", "emailLine2", "email",
      "activeStatus", "lastActivityDate", "sei", "mei", "nickname", "phone",
      "postcode", "address1", "address2", "address3", "nenrei", "nendai", "seibetu",
      "free1", "free2", "free3", "free4", "free5", "free6",
      "scenarioPos1", "scenarioPos2", "scenarioPos3", "scenarioPos4", "scenarioPos5",
    ];

    for (const field of stringFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field] ? String(data[field]).trim() : null;
      }
    }

    if (data.friendAddedDate !== undefined) {
      updateData.friendAddedDate = data.friendAddedDate ? new Date(String(data.friendAddedDate)) : null;
    }

    // uid変更時は重複チェック
    if (data.uid !== undefined) {
      const newUid = String(data.uid).trim();
      if (current.uid !== newUid) {
        const existing = await prisma.slpLineFriend.findUnique({ where: { uid: newUid } });
        if (existing) return err(`UID「${newUid}」は既に使用されています`);
        updateData.uid = newUid;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.slpLineFriend.update({ where: { id }, data: updateData });
    }

    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[updateLineFriend] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteLineFriend(id: number): Promise<ActionResult> {
  try {
    // 削除可否チェック（プロライン由来は不可）
    const current = await prisma.slpLineFriend.findUnique({
      where: { id },
      select: { isManuallyAdded: true },
    });
    if (!current) return err("LINE友達が見つかりません");
    if (!current.isManuallyAdded) {
      return err("プロライン由来のデータは削除できません");
    }

    await prisma.slpLineFriend.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[deleteLineFriend] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

// === AS管理 ===

export async function addSlpAs(data: {
  name: string;
  lineFriendId: number | null;
  staffId: number | null;
}): Promise<ActionResult> {
  try {
    if (!data.name.trim()) {
      return err("名前は必須です");
    }

    await prisma.slpAs.create({
      data: {
        name: data.name.trim(),
        lineFriend: data.lineFriendId
          ? { connect: { id: data.lineFriendId } }
          : undefined,
        staff: data.staffId ? { connect: { id: data.staffId } } : undefined,
      },
    });

    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[addSlpAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateSlpAs(
  id: number,
  data: {
    name: string;
    lineFriendId: number | null;
    staffId: number | null;
  }
): Promise<ActionResult> {
  try {
    if (!data.name.trim()) {
      return err("名前は必須です");
    }

    await prisma.slpAs.update({
      where: { id },
      data: {
        name: data.name.trim(),
        lineFriend: data.lineFriendId
          ? { connect: { id: data.lineFriendId } }
          : { disconnect: true },
        staff: data.staffId
          ? { connect: { id: data.staffId } }
          : { disconnect: true },
      },
    });

    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[updateSlpAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteSlpAs(id: number): Promise<ActionResult> {
  try {
    await prisma.slpAs.delete({ where: { id } });
    revalidatePath("/slp/line-friends");
    return ok();
  } catch (e) {
    console.error("[deleteSlpAs] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/**
 * 指定LINE友達に対してリッチメニューを開放する（autosns call-beacon経由）
 */
export async function openRichMenu(
  lineFriendId: number
): Promise<{ success: boolean; error?: string }> {
  const friend = await prisma.slpLineFriend.findUnique({
    where: { id: lineFriendId },
    select: { uid: true, snsname: true },
  });
  if (!friend) {
    return { success: false, error: "LINE友達が見つかりません" };
  }

  try {
    await openRichMenuForFriend(friend.uid);
    return { success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await logAutomationError({
      source: "slp-rich-menu-open",
      message: `リッチメニュー開放失敗: ${friend.snsname ?? "(名前なし)"} (uid=${friend.uid})`,
      detail: {
        error: errMsg,
        uid: friend.uid,
        lineFriendId,
        retryAction: "rich-menu-open",
      },
    });
    return { success: false, error: errMsg };
  }
}

export async function triggerProLineSync(): Promise<{
  success: boolean;
  created?: number;
  updated?: number;
  total?: number;
  error?: string;
}> {
  const triggerUrl =
    process.env.PROLINE_SYNC_TRIGGER_URL || "http://host.docker.internal:3100";
  const cronSecret = process.env.CRON_SECRET;
  // DEPLOY_ENV=stg|prod を .env.stg / .env.prod に設定しておくと、
  // VPS 上の sync-trigger-server が環境別の APP_URL/CRON_SECRET に切り替える
  const deployEnv = process.env.DEPLOY_ENV;

  if (!cronSecret) {
    return { success: false, error: "CRON_SECRET未設定" };
  }

  try {
    const envQuery = deployEnv ? `&env=${encodeURIComponent(deployEnv)}` : "";
    const res = await fetch(
      `${triggerUrl}/trigger?secret=${encodeURIComponent(cronSecret)}${envQuery}`,
      {
        signal: AbortSignal.timeout(120000), // 120秒タイムアウト
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    revalidatePath("/slp/line-friends");
    return {
      success: true,
      created: data.created,
      updated: data.updated,
      total: data.total,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[triggerProLineSync] エラー:", message);
    return { success: false, error: message };
  }
}
