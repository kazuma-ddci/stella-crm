"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const VALID_USER_TYPES = ["顧客", "AS", "スタッフ", "その他"];

export async function updateCustomerUserType(id: number, userType: string) {
  if (!VALID_USER_TYPES.includes(userType)) {
    throw new Error(`無効なユーザー種別です: ${userType}`);
  }

  // ベンダーとして登録されているかチェック（旧フィールド + contacts両方）
  const vendor = await prisma.hojoVendor.findFirst({
    where: { lineFriendId: id },
  });
  const vendorContact = await prisma.hojoVendorContact.findFirst({
    where: { lineFriendId: id },
  });
  if (vendor || vendorContact) {
    throw new Error("このユーザーはベンダーとして登録されているため、ユーザー種別を変更できません");
  }

  await prisma.hojoLineFriendSecurityCloud.update({
    where: { id },
    data: { userType },
  });

  revalidatePath("/hojo/user-info");
}
