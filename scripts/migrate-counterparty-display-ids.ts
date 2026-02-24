/**
 * 既存 Counterparty に displayId を自動採番するスクリプト
 *
 * - companyId != null → SC-{id}（Stella顧客）
 * - companyId == null → TP-{id}（Third Party）
 *
 * 使い方:
 *   npx tsx scripts/migrate-counterparty-display-ids.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const counterparties = await prisma.counterparty.findMany({
    where: { displayId: null },
    orderBy: { id: "asc" },
  });

  if (counterparties.length === 0) {
    console.log("全ての取引先に displayId が設定済みです。");
    return;
  }

  console.log(`${counterparties.length}件の取引先に displayId を採番します...`);

  for (const cp of counterparties) {
    const prefix = cp.companyId != null ? "SC" : "TP";
    const displayId = `${prefix}-${cp.id}`;

    await prisma.counterparty.update({
      where: { id: cp.id },
      data: { displayId },
    });

    console.log(`  ${cp.name} → ${displayId}`);
  }

  console.log("完了しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
