"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function registerVendorAccount(data: {
  name: string;
  email: string;
  password: string;
  vendorToken: string;
}) {
  const { name, email, password, vendorToken } = data;

  if (!name.trim() || !email.trim() || !password.trim()) {
    throw new Error("すべての項目を入力してください");
  }
  if (password.length < 8) {
    throw new Error("パスワードは8文字以上にしてください");
  }

  // トークンからベンダーを特定
  const vendor = await prisma.hojoVendor.findUnique({
    where: { accessToken: vendorToken },
  });
  if (!vendor || !vendor.isActive) {
    throw new Error("無効なURLです");
  }

  // メールアドレスの重複チェック
  const existingVendor = await prisma.hojoVendorAccount.findUnique({ where: { email: email.trim() } });
  if (existingVendor) throw new Error("このメールアドレスは既に登録されています");
  const existingBbs = await prisma.hojoBbsAccount.findUnique({ where: { email: email.trim() } });
  if (existingBbs) throw new Error("このメールアドレスは既に使用されています");
  const existingStaff = await prisma.masterStaff.findUnique({ where: { email: email.trim() } });
  if (existingStaff) throw new Error("このメールアドレスは既に使用されています");

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.hojoVendorAccount.create({
    data: {
      vendorId: vendor.id,
      name: name.trim(),
      email: email.trim(),
      passwordHash,
    },
  });
}

export async function recordVendorPasswordResetRequest(email: string) {
  const account = await prisma.hojoVendorAccount.findUnique({ where: { email } });
  if (account) {
    await prisma.hojoVendorAccount.update({
      where: { id: account.id },
      data: { passwordResetRequestedAt: new Date() },
    });
  }
}

export async function updateVendorFields(
  applicationSupportId: number,
  vendorId: number,
  data: { subsidyDesiredDate?: string | null; subsidyAmount?: number | null; vendorMemo?: string | null }
) {
  // レコードがこのベンダーのものか確認（vendorIdは申請者管理ページでfree1から自動同期済み）
  const record = await prisma.hojoApplicationSupport.findUnique({
    where: { id: applicationSupportId },
  });
  if (!record || record.vendorId !== vendorId || record.deletedAt) {
    throw new Error("レコードが見つかりません");
  }

  const updateData: Record<string, unknown> = {};
  if (data.subsidyDesiredDate !== undefined) {
    updateData.subsidyDesiredDate = data.subsidyDesiredDate ? new Date(data.subsidyDesiredDate) : null;
  }
  if (data.subsidyAmount !== undefined) {
    updateData.subsidyAmount = data.subsidyAmount ?? null;
  }
  if (data.vendorMemo !== undefined) {
    updateData.vendorMemo = data.vendorMemo?.trim() || null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoApplicationSupport.update({
      where: { id: applicationSupportId },
      data: updateData,
    });
  }

  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/application-support");
}

export async function changeVendorPassword(accountId: number, newPassword: string) {
  if (newPassword.length < 8) throw new Error("パスワードは8文字以上にしてください");
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.hojoVendorAccount.update({
    where: { id: accountId },
    data: { passwordHash, mustChangePassword: false },
  });
}

// ========== 卸アカウント管理 ==========

export async function addWholesaleAccount(vendorId: number, data: Record<string, unknown>) {
  await prisma.hojoWholesaleAccount.create({
    data: {
      vendorId,
      supportProviderName: data.supportProviderName ? String(data.supportProviderName).trim() : null,
      companyName: data.companyName ? String(data.companyName).trim() : null,
      email: data.email ? String(data.email).trim() : null,
      softwareSalesContractUrl: data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null,
      recruitmentRound: data.recruitmentRound ? Number(data.recruitmentRound) : null,
      adoptionDate: data.adoptionDate ? new Date(String(data.adoptionDate)) : null,
      issueRequestDate: data.issueRequestDate ? new Date(String(data.issueRequestDate)) : null,
      grantDate: data.grantDate ? new Date(String(data.grantDate)) : null,
    },
  });
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}

export async function updateWholesaleAccountByVendor(
  id: number,
  vendorId: number,
  data: Record<string, unknown>
) {
  const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
  if (!record || record.vendorId !== vendorId || record.deletedAt) {
    throw new Error("レコードが見つかりません");
  }

  const updateData: Record<string, unknown> = {};
  if (data.supportProviderName !== undefined) updateData.supportProviderName = data.supportProviderName ? String(data.supportProviderName).trim() : null;
  if (data.companyName !== undefined) updateData.companyName = data.companyName ? String(data.companyName).trim() : null;
  if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
  if (data.softwareSalesContractUrl !== undefined) updateData.softwareSalesContractUrl = data.softwareSalesContractUrl ? String(data.softwareSalesContractUrl).trim() : null;
  if (data.recruitmentRound !== undefined) updateData.recruitmentRound = data.recruitmentRound ? Number(data.recruitmentRound) : null;
  const dateFields = ["adoptionDate", "issueRequestDate", "grantDate"];
  for (const field of dateFields) {
    if (data[field] !== undefined) updateData[field] = data[field] ? new Date(String(data[field])) : null;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.hojoWholesaleAccount.update({ where: { id }, data: updateData });
  }
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}

export async function deleteWholesaleAccountByVendor(id: number, vendorId: number) {
  const record = await prisma.hojoWholesaleAccount.findUnique({ where: { id } });
  if (!record || record.vendorId !== vendorId) throw new Error("レコードが見つかりません");
  await prisma.hojoWholesaleAccount.update({
    where: { id },
    data: { deletedByVendor: true },
  });
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
}
