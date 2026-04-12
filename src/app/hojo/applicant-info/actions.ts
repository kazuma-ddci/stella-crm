"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

const VALID_USER_TYPES = ["顧客", "AS", "スタッフ", "その他"];

export async function updateUserType(id: number, userType: string): Promise<ActionResult> {
  // 認証: 補助金プロジェクトの編集権限以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    if (!VALID_USER_TYPES.includes(userType)) {
      return err(`無効なユーザー種別です: ${userType}`);
    }

    // ベンダーとして登録されているかチェック（旧フィールド + contacts両方）
    const vendor = await prisma.hojoVendor.findFirst({
      where: { joseiLineFriendId: id },
    });
    const vendorContact = await prisma.hojoVendorContact.findFirst({
      where: { joseiLineFriendId: id },
    });
    if (vendor || vendorContact) {
      return err("このユーザーはベンダーとして登録されているため、ユーザー種別を変更できません");
    }

    await prisma.hojoLineFriendJoseiSupport.update({
      where: { id },
      data: { userType },
    });

    revalidatePath("/hojo/applicant-info");
    return ok();
  } catch (e) {
    console.error("[updateUserType] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
