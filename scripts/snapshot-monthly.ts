/**
 * 月次スナップショット記録スクリプト
 * 月末にcronで実行し、代理店数等のKPIスナップショットを保存する
 *
 * 実行方法（Docker内）:
 *   npx tsx scripts/snapshot-monthly.ts
 *
 * cron設定（毎月末日 23:55 に実行）:
 *   55 23 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && docker compose exec -T app npx tsx scripts/snapshot-monthly.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  console.log(`[snapshot-monthly] ${yearMonth} のスナップショットを記録中...`);

  // 1. アクティブ代理店数
  const activeAgentCount = await prisma.stpAgent.count({
    where: { status: "アクティブ" },
  });

  await prisma.monthlySnapshot.upsert({
    where: {
      yearMonth_snapshotKey: {
        yearMonth,
        snapshotKey: "active_agent_count",
      },
    },
    update: { value: activeAgentCount },
    create: {
      yearMonth,
      snapshotKey: "active_agent_count",
      value: activeAgentCount,
    },
  });

  console.log(`  active_agent_count: ${activeAgentCount}`);

  // 2. アクティブ契約企業数
  const activeContractCompanies = await prisma.stpContractHistory.findMany({
    where: {
      deletedAt: null,
      status: "active",
      contractStartDate: { lte: now },
      OR: [
        { contractEndDate: null },
        { contractEndDate: { gte: now } },
      ],
    },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  await prisma.monthlySnapshot.upsert({
    where: {
      yearMonth_snapshotKey: {
        yearMonth,
        snapshotKey: "active_contract_company_count",
      },
    },
    update: { value: activeContractCompanies.length },
    create: {
      yearMonth,
      snapshotKey: "active_contract_company_count",
      value: activeContractCompanies.length,
    },
  });

  console.log(`  active_contract_company_count: ${activeContractCompanies.length}`);

  console.log(`[snapshot-monthly] 完了`);
}

main()
  .catch((e) => {
    console.error("[snapshot-monthly] エラー:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
