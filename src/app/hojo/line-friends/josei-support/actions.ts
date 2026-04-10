"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncVendorIdFromFree1 } from "@/lib/hojo/sync-vendor-id";
import { ok, err, type ActionResult } from "@/lib/action-result";

const REVALIDATE_PATH = "/hojo/line-friends/josei-support";

export async function addLineFriend(data: Record<string, unknown>): Promise<ActionResult> {
  try {
  const uid = String(data.uid ?? "").trim();
  if (!uid) return err("UIDは必須です");

  const existing = await prisma.hojoLineFriendJoseiSupport.findUnique({ where: { uid } });
  if (existing) return err(`UID「${uid}」は既に使用されています`);

  await prisma.hojoLineFriendJoseiSupport.create({
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
    },
  });

  revalidatePath(REVALIDATE_PATH);
  return ok();
  } catch (e) {
    console.error("[addLineFriend:josei-support] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function updateLineFriend(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  try {
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

  if (data.uid !== undefined) {
    const newUid = String(data.uid).trim();
    const current = await prisma.hojoLineFriendJoseiSupport.findUnique({ where: { id } });
    if (current && current.uid !== newUid) {
      const existing = await prisma.hojoLineFriendJoseiSupport.findUnique({ where: { uid: newUid } });
      if (existing) return err(`UID「${newUid}」は既に使用されています`);
      updateData.uid = newUid;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoLineFriendJoseiSupport.update({ where: { id }, data: updateData });

    // free1が変更された場合、申請管理のvendorIdを同期
    if (updateData.free1 !== undefined) {
      await syncVendorIdFromFree1(id);
    }
  }

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/application-support");
  return ok();
  } catch (e) {
    console.error("[updateLineFriend:josei-support] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function deleteLineFriend(id: number): Promise<ActionResult> {
  try {
    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteLineFriend:josei-support] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
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
      `${triggerUrl}/trigger?secret=${encodeURIComponent(cronSecret)}&account=josei-support${envQuery}`,
      {
        signal: AbortSignal.timeout(120000),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    revalidatePath(REVALIDATE_PATH);
    return {
      success: true,
      created: data.created,
      updated: data.updated,
      total: data.total,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[triggerProLineSync:josei-support] エラー:", message);
    return { success: false, error: message };
  }
}
