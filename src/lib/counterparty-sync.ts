import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

/**
 * displayIdの次番号を生成する。
 * prefix: "SC" or "TP"
 */
async function generateDisplayId(
  prefix: "SC" | "TP",
  db: TxClient | typeof prisma
): Promise<string> {
  const all = await db.counterparty.findMany({
    where: { displayId: { startsWith: `${prefix}-` } },
    select: { displayId: true },
  });
  let maxNum = 0;
  for (const row of all) {
    if (row.displayId) {
      const num = Number(row.displayId.replace(`${prefix}-`, ""));
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

/**
 * その他取引先（companyId=null）作成時のTP-X displayIdを生成する。
 */
export async function generateOtherCounterpartyDisplayId(
  db?: TxClient | typeof prisma
): Promise<string> {
  return generateDisplayId("TP", db ?? prisma);
}

/**
 * MasterStellaCompany作成時にCounterpartyを自動作成する。
 * 既に同じcompanyIdのCounterpartyが存在する場合はスキップ。
 * displayId重複（P2002）時は最大3回リトライする。
 */
export async function createCounterpartyForCompany(
  companyId: number,
  companyName: string,
  staffId: number,
  tx?: TxClient
) {
  const db = tx ?? prisma;
  for (let attempt = 0; attempt < 3; attempt++) {
    // 毎回既存チェック（別リクエストが先に作成した場合に重複を防ぐ）
    const existing = await db.counterparty.findFirst({
      where: { companyId, deletedAt: null, mergedIntoId: null },
      select: { id: true },
    });
    if (existing) return;

    const displayId = await generateDisplayId("SC", db);
    try {
      await db.counterparty.create({
        data: {
          displayId,
          name: companyName,
          companyId,
          counterpartyType: "customer",
          isActive: true,
          createdBy: staffId,
        },
      });
      return;
    } catch (e: unknown) {
      const isPrismaUniqueError = e instanceof Error && "code" in e && (e as { code: string }).code === "P2002";
      if (isPrismaUniqueError && attempt < 2) continue;
      throw e;
    }
  }
}

/**
 * MasterStellaCompany名称変更時にCounterpartyの名称も同期更新する。
 */
export async function updateCounterpartyForCompany(
  companyId: number,
  newName: string,
  staffId: number,
  tx?: TxClient
) {
  const db = tx ?? prisma;
  await db.counterparty.updateMany({
    where: { companyId, deletedAt: null, mergedIntoId: null },
    data: { name: newName, updatedBy: staffId },
  });
}

/**
 * MasterStellaCompany論理削除時にCounterpartyも無効化する。
 */
export async function deactivateCounterpartyForCompany(
  companyId: number,
  staffId: number,
  tx?: TxClient
) {
  const db = tx ?? prisma;
  await db.counterparty.updateMany({
    where: { companyId, deletedAt: null },
    data: { isActive: false, updatedBy: staffId },
  });
}

/**
 * MasterStellaCompany統合時にCounterpartyも統合する。
 * 統合元のCounterpartyを統合先のCounterpartyにマージ（FK付替え + 論理削除）。
 */
export async function mergeCounterpartyForCompany(
  survivorCompanyId: number,
  duplicateCompanyId: number,
  tx: TxClient
) {
  const survivorCp = await tx.counterparty.findFirst({
    where: { companyId: survivorCompanyId, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });
  const duplicateCp = await tx.counterparty.findFirst({
    where: { companyId: duplicateCompanyId, deletedAt: null, mergedIntoId: null },
    select: { id: true },
  });

  if (!duplicateCp) return;

  if (survivorCp) {
    // 統合元のCounterpartyのFK参照を統合先に付替え
    await Promise.all([
      tx.transaction.updateMany({
        where: { counterpartyId: duplicateCp.id },
        data: { counterpartyId: survivorCp.id },
      }),
      tx.recurringTransaction.updateMany({
        where: { counterpartyId: duplicateCp.id },
        data: { counterpartyId: survivorCp.id },
      }),
      tx.autoJournalRule.updateMany({
        where: { counterpartyId: duplicateCp.id },
        data: { counterpartyId: survivorCp.id },
      }),
      tx.invoiceGroup.updateMany({
        where: { counterpartyId: duplicateCp.id },
        data: { counterpartyId: survivorCp.id },
      }),
      tx.paymentGroup.updateMany({
        where: { counterpartyId: duplicateCp.id },
        data: { counterpartyId: survivorCp.id },
      }),
    ]);

    // 統合元を論理削除
    const now = new Date();
    await tx.counterparty.update({
      where: { id: duplicateCp.id },
      data: { mergedIntoId: survivorCp.id, mergedAt: now, deletedAt: now },
    });
  } else {
    // 統合先にCounterpartyがない場合、統合元のcompanyIdを付替え
    await tx.counterparty.update({
      where: { id: duplicateCp.id },
      data: { companyId: survivorCompanyId },
    });
  }
}
