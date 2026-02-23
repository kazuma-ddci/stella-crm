"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const VALID_TYPES = ["customer", "vendor", "service", "other"] as const;

// 類似名称チェック（前方一致・部分一致）
export async function checkSimilarCounterparties(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const candidates = await prisma.counterparty.findMany({
    where: {
      deletedAt: null,
      mergedIntoId: null,
      OR: [
        { name: { startsWith: trimmed } },
        { name: { contains: trimmed } },
      ],
    },
    select: {
      id: true,
      name: true,
      counterpartyType: true,
      isActive: true,
      company: { select: { id: true, name: true } },
    },
    take: 10,
  });

  return candidates;
}

// 新規作成
export async function createCounterparty(data: Record<string, unknown>) {
  const session = await getSession();
  const staffId = session.id;

  const name = (data.name as string).trim();
  const counterpartyType = data.counterpartyType as string;
  const companyId = data.companyId ? Number(data.companyId) : null;
  const memo = data.memo ? (data.memo as string).trim() : null;
  const isActive = data.isActive !== false && data.isActive !== "false";

  if (!name || !counterpartyType) {
    throw new Error("名称と種別は必須です");
  }

  if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
    throw new Error("無効な種別です");
  }

  // 名称重複チェック（論理削除・統合済みを除く）
  const existing = await prisma.counterparty.findFirst({
    where: { name, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`取引先「${name}」は既に登録されています`);
  }

  // companyId指定時、既にその企業に紐づく取引先がないかチェック
  if (companyId) {
    const existingCompanyLink = await prisma.counterparty.findFirst({
      where: { companyId, deletedAt: null, mergedIntoId: null },
      select: { id: true, name: true },
    });
    if (existingCompanyLink) {
      throw new Error(
        `この企業は既に取引先「${existingCompanyLink.name}」と紐づいています`
      );
    }
  }

  await prisma.counterparty.create({
    data: {
      name,
      counterpartyType,
      companyId,
      memo: memo || null,
      isActive,
      createdBy: staffId,
    },
  });

  revalidatePath("/accounting/masters/counterparties");
}

// 更新（部分更新対応）
export async function updateCounterparty(
  id: number,
  data: Record<string, unknown>
) {
  const session = await getSession();
  const staffId = session.id;

  const updateData: Record<string, unknown> = {};

  if ("name" in data) {
    const name = (data.name as string).trim();
    if (!name) throw new Error("名称は必須です");

    // 名称重複チェック（自分自身は除く）
    const existing = await prisma.counterparty.findFirst({
      where: { name, deletedAt: null, mergedIntoId: null, id: { not: id } },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`取引先「${name}」は既に登録されています`);
    }
    updateData.name = name;
  }

  if ("counterpartyType" in data) {
    const counterpartyType = data.counterpartyType as string;
    if (!(VALID_TYPES as readonly string[]).includes(counterpartyType)) {
      throw new Error("無効な種別です");
    }
    updateData.counterpartyType = counterpartyType;
  }

  if ("companyId" in data) {
    const companyId = data.companyId ? Number(data.companyId) : null;

    // companyId指定時、既にその企業に紐づく取引先がないかチェック（自分自身除外）
    if (companyId) {
      const existingCompanyLink = await prisma.counterparty.findFirst({
        where: {
          companyId,
          deletedAt: null,
          mergedIntoId: null,
          id: { not: id },
        },
        select: { id: true, name: true },
      });
      if (existingCompanyLink) {
        throw new Error(
          `この企業は既に取引先「${existingCompanyLink.name}」と紐づいています`
        );
      }
    }
    updateData.companyId = companyId;
  }

  if ("memo" in data) {
    updateData.memo = data.memo ? (data.memo as string).trim() || null : null;
  }

  if ("isActive" in data) {
    updateData.isActive = data.isActive === true || data.isActive === "true";
  }

  updateData.updatedBy = staffId;

  await prisma.counterparty.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/accounting/masters/counterparties");
}

// MasterStellaCompanyとの同期処理（設計書8.6）
export async function syncCounterparties() {
  const session = await getSession();
  const staffId = session.id;

  // 全MasterStellaCompany（論理削除されていないもの）を取得
  const companies = await prisma.masterStellaCompany.findMany({
    where: { deletedAt: null, mergedIntoId: null },
    select: { id: true, name: true },
  });

  // 既にcompanyIdが設定されているCounterpartyを取得
  const existingLinks = await prisma.counterparty.findMany({
    where: { companyId: { not: null }, deletedAt: null },
    select: { id: true, companyId: true, name: true },
  });

  const linkedCompanyIds = new Set(
    existingLinks.map((link) => link.companyId as number)
  );

  let created = 0;
  let updated = 0;

  for (const company of companies) {
    if (linkedCompanyIds.has(company.id)) {
      // 既存リンクがある → 名称を同期更新
      const existing = existingLinks.find(
        (link) => link.companyId === company.id
      );
      if (existing && existing.name !== company.name) {
        await prisma.counterparty.update({
          where: { id: existing.id },
          data: { name: company.name, updatedBy: staffId },
        });
        updated++;
      }
    } else {
      // 新規作成（companyId紐づき）
      await prisma.counterparty.create({
        data: {
          name: company.name,
          companyId: company.id,
          counterpartyType: "customer",
          isActive: true,
          createdBy: staffId,
        },
      });
      created++;
    }
  }

  revalidatePath("/accounting/masters/counterparties");

  return { created, updated, total: companies.length };
}
