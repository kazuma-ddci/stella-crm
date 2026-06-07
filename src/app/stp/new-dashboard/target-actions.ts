"use server";

import { revalidatePath } from "next/cache";
import { requireEdit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALL_STAFF, FALLBACK_PRODUCT, type FunnelTargetValues } from "./types";

type SaveDashboardTargetParams = {
  targetMonth: string;
  product: string;
  staff: string;
  values: FunnelTargetValues;
};

const TARGET_KEYS = ["lead", "validLead", "meeting", "pending", "contract", "lost"] as const;

function sanitizeTargetValue(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("目標値は0以上の整数で入力してください。");
  }
  return value;
}

function productKeyFromId(productId: number | null) {
  return productId ? `product:${productId}` : FALLBACK_PRODUCT;
}

function staffKeyFromId(staffId: number | null) {
  return staffId ? `staff:${staffId}` : ALL_STAFF;
}

export async function saveDashboardFunnelTargets(params: SaveDashboardTargetParams) {
  await requireEdit("stp");

  if (!/^\d{4}-\d{2}$/.test(params.targetMonth)) {
    throw new Error("対象月が不正です。");
  }

  const parsedProductId = params.product !== FALLBACK_PRODUCT ? Number(params.product) : null;
  if (parsedProductId != null && !Number.isInteger(parsedProductId)) {
    throw new Error("商材が不正です。");
  }
  const product = parsedProductId
    ? await prisma.stpProduct.findFirst({
        where: { id: parsedProductId, isActive: true },
        select: { id: true, name: true },
      })
    : null;
  if (parsedProductId && !product) {
    throw new Error("商材が見つかりません。");
  }

  const parsedStaffId = params.staff !== ALL_STAFF ? Number(params.staff) : null;
  if (parsedStaffId != null && !Number.isInteger(parsedStaffId)) {
    throw new Error("担当者が不正です。");
  }
  const staff = parsedStaffId
    ? await prisma.masterStaff.findFirst({
        where: { id: parsedStaffId, isActive: true, isSystemUser: false },
        select: { id: true, name: true },
      })
    : null;
  if (parsedStaffId && !staff) {
    throw new Error("担当者が見つかりません。");
  }

  const values = TARGET_KEYS.reduce(
    (acc, key) => ({
      ...acc,
      [key]: sanitizeTargetValue(params.values[key]),
    }),
    {} as FunnelTargetValues
  );

  const productId = product?.id ?? null;
  const staffId = staff?.id ?? null;
  const productKey = productKeyFromId(productId);
  const staffKey = staffKeyFromId(staffId);

  await prisma.stpDashboardFunnelTarget.upsert({
    where: {
      targetMonth_productKey_staffKey: {
        targetMonth: params.targetMonth,
        productKey,
        staffKey,
      },
    },
    update: {
      productName: product?.name ?? "採用ブースト",
      productId,
      staffName: staff?.name ?? "すべて",
      salesStaffId: staffId,
      leadTarget: values.lead,
      validLeadTarget: values.validLead,
      meetingTarget: values.meeting,
      pendingTarget: values.pending,
      contractTarget: values.contract,
      lostTarget: values.lost,
    },
    create: {
      targetMonth: params.targetMonth,
      productKey,
      productName: product?.name ?? "採用ブースト",
      productId,
      staffKey,
      staffName: staff?.name ?? "すべて",
      salesStaffId: staffId,
      leadTarget: values.lead,
      validLeadTarget: values.validLead,
      meetingTarget: values.meeting,
      pendingTarget: values.pending,
      contractTarget: values.contract,
      lostTarget: values.lost,
    },
  });

  revalidatePath("/stp/new-dashboard");
}
