import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Target,
  Clock,
  Users,
  Building2,
  Percent,
  CalendarClock,
} from "lucide-react";
import { getAnnualRevenueTarget } from "./actions";
import { RevenueTargetEditor } from "./revenue-target-editor";

export default async function StpDashboardPage() {
  const now = new Date();
  const fiscalYearStart = new Date(now.getFullYear(), 0, 1);
  const fiscalYearEnd = new Date(now.getFullYear(), 11, 31);

  const [
    annualRevenueTarget,
    contracts2026,
    activeContracts,
    totalLeadCount,
    companiesWithFirstContract,
    activeCompaniesPlannedHires,
    hiredCandidatesCount,
    contractedCompaniesWithStageHistory,
  ] = await Promise.all([
    // 目標値をDBから取得
    getAnnualRevenueTarget(),

    // 2026年に有効な契約履歴（売上計算用）
    prisma.stpContractHistory.findMany({
      where: {
        deletedAt: null,
        status: { in: ["active", "cancelled", "dormant"] },
        contractStartDate: { lte: fiscalYearEnd },
        OR: [
          { contractEndDate: null },
          { contractEndDate: { gte: fiscalYearStart } },
        ],
      },
      select: {
        contractStartDate: true,
        contractEndDate: true,
        initialFee: true,
        monthlyFee: true,
      },
    }),

    // 契約中（active）の契約
    prisma.stpContractHistory.findMany({
      where: { deletedAt: null, status: "active" },
      select: { companyId: true },
    }),

    // 全STP企業数（リード数）
    prisma.stpCompany.count({ where: { company: { deletedAt: null } } }),

    // 企業ごとの初回契約日 + リード作成日
    prisma.stpCompany.findMany({
      where: {
        company: {
          deletedAt: null,
          stpContractHistories: {
            some: { deletedAt: null },
          },
        },
      },
      select: {
        id: true,
        leadAcquiredDate: true,
        company: {
          select: {
            stpContractHistories: {
              where: { deletedAt: null },
              orderBy: { contractStartDate: "asc" },
              take: 1,
              select: { contractStartDate: true },
            },
          },
        },
      },
    }),

    // 契約中企業のplannedHires
    prisma.stpCompany.findMany({
      where: {
        company: {
          deletedAt: null,
          stpContractHistories: {
            some: { deletedAt: null, status: "active" },
          },
        },
      },
      select: { plannedHires: true },
    }),

    // 入社済み求職者数
    prisma.stpCandidate.count({
      where: {
        deletedAt: null,
        selectionStatus: "入社済み",
      },
    }),

    // 契約中企業の初回契約開始日 + 商談化ステージ履歴
    prisma.stpCompany.findMany({
      where: {
        company: {
          deletedAt: null,
          stpContractHistories: {
            some: { deletedAt: null, status: "active" },
          },
        },
      },
      select: {
        id: true,
        company: {
          select: {
            stpContractHistories: {
              where: { deletedAt: null, status: "active" },
              orderBy: { contractStartDate: "asc" },
              take: 1,
              select: { contractStartDate: true },
            },
          },
        },
        stageHistories: {
          where: {
            isVoided: false,
            toStageId: 2,
          },
          orderBy: { recordedAt: "asc" },
          take: 1,
          select: { recordedAt: true },
        },
      },
    }),
  ]);

  // ========================================
  // 1. 年間売上（契約履歴から計算）
  // ========================================
  let annualRevenue = 0;
  for (const c of contracts2026) {
    const start = new Date(c.contractStartDate);
    const end = c.contractEndDate ? new Date(c.contractEndDate) : fiscalYearEnd;

    // 初期費用: 契約開始日が今年なら加算
    if (
      start.getFullYear() === now.getFullYear()
    ) {
      annualRevenue += c.initialFee;
    }

    // 月額: 今年の有効月数分を加算
    const effectiveStart =
      start > fiscalYearStart ? start : fiscalYearStart;
    const effectiveEnd = end < fiscalYearEnd ? end : fiscalYearEnd;

    if (effectiveStart <= effectiveEnd) {
      const startMonth =
        effectiveStart.getFullYear() * 12 + effectiveStart.getMonth();
      const endMonth =
        effectiveEnd.getFullYear() * 12 + effectiveEnd.getMonth();
      const months = endMonth - startMonth + 1;
      annualRevenue += c.monthlyFee * months;
    }
  }

  const budgetAchievementRate =
    annualRevenueTarget > 0
      ? Math.round((annualRevenue / annualRevenueTarget) * 1000) / 10
      : 0;

  // ========================================
  // 2. 着金LT（平均日数）
  // ========================================
  const paymentLTs: number[] = [];
  for (const c of companiesWithFirstContract) {
    const firstContract = c.company.stpContractHistories[0];
    if (c.leadAcquiredDate && firstContract?.contractStartDate) {
      const leadDate = new Date(c.leadAcquiredDate);
      const contractDate = new Date(firstContract.contractStartDate);
      const diffDays = Math.round(
        (contractDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 0) paymentLTs.push(diffDays);
    }
  }
  const avgPaymentLT =
    paymentLTs.length > 0
      ? Math.round(paymentLTs.reduce((a, b) => a + b, 0) / paymentLTs.length)
      : null;

  // ========================================
  // 3. 採用目標達成率
  // ========================================
  const totalPlannedHires = activeCompaniesPlannedHires.reduce(
    (sum, c) => sum + (c.plannedHires || 0),
    0
  );
  const hiringAchievementRate =
    totalPlannedHires > 0
      ? Math.round((hiredCandidatesCount / totalPlannedHires) * 1000) / 10
      : 0;

  // ========================================
  // 4. 現状顧客数
  // ========================================
  const activeCompanyIds = new Set(activeContracts.map((c) => c.companyId));
  const activeCustomerCount = activeCompanyIds.size;

  // ========================================
  // 5. 成約率
  // ========================================
  const conversionRate =
    totalLeadCount > 0
      ? Math.round((activeCustomerCount / totalLeadCount) * 1000) / 10
      : 0;

  // ========================================
  // 6. 商談→契約LT（平均日数）
  // ========================================
  const dealLTs: number[] = [];
  for (const c of contractedCompaniesWithStageHistory) {
    const firstContract = c.company.stpContractHistories[0];
    const shoudanka = c.stageHistories[0];
    if (shoudanka?.recordedAt && firstContract?.contractStartDate) {
      const shoudankaDate = new Date(shoudanka.recordedAt);
      const contractDate = new Date(firstContract.contractStartDate);
      const diffDays = Math.round(
        (contractDate.getTime() - shoudankaDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (diffDays >= 0) dealLTs.push(diffDays);
    }
  }
  const avgDealLT =
    dealLTs.length > 0
      ? Math.round(dealLTs.reduce((a, b) => a + b, 0) / dealLTs.length)
      : null;

  // ========================================
  // ヘルパー
  // ========================================
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ja-JP").format(value);

  const progressBarColor = (rate: number) => {
    if (rate >= 100) return "bg-green-500";
    if (rate >= 70) return "bg-blue-500";
    if (rate >= 40) return "bg-yellow-500";
    return "bg-red-400";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">
        採用ブースト ダッシュボード
      </h1>

      {/* === メインKPIカード 上段 === */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 年間予算達成率 */}
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              年間予算達成率
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{budgetAchievementRate}%</div>
            <div className="mt-3 h-3 w-full rounded-full bg-gray-100">
              <div
                className={`h-3 rounded-full transition-all ${progressBarColor(budgetAchievementRate)}`}
                style={{
                  width: `${Math.min(budgetAchievementRate, 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>確定売上: ¥{formatCurrency(annualRevenue)}</span>
              <span>
                目標:{" "}
                <RevenueTargetEditor currentTarget={annualRevenueTarget} />
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 採用目標達成率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              採用目標達成率
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hiringAchievementRate}%</div>
            <div className="mt-3 h-3 w-full rounded-full bg-gray-100">
              <div
                className={`h-3 rounded-full transition-all ${progressBarColor(hiringAchievementRate)}`}
                style={{
                  width: `${Math.min(hiringAchievementRate, 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>入社済み: {hiredCandidatesCount}名</span>
              <span>目標: {totalPlannedHires}名</span>
            </div>
          </CardContent>
        </Card>

        {/* 成約率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成約率</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{conversionRate}%</div>
            <div className="mt-3 h-3 w-full rounded-full bg-gray-100">
              <div
                className={`h-3 rounded-full transition-all ${progressBarColor(conversionRate)}`}
                style={{
                  width: `${Math.min(conversionRate, 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>契約中: {activeCustomerCount}社</span>
              <span>リード数: {totalLeadCount}社</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === サブKPIカード 下段 === */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 現状顧客数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">現状顧客数</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCustomerCount}社</div>
            <p className="mt-1 text-xs text-muted-foreground">
              契約中（active）の企業数
            </p>
          </CardContent>
        </Card>

        {/* 着金LT */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">着金LT</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgPaymentLT !== null ? `${avgPaymentLT}日` : "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              初回契約日 - リード作成日の平均
              {paymentLTs.length > 0 && `（${paymentLTs.length}社）`}
            </p>
          </CardContent>
        </Card>

        {/* 商談→契約LT */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              商談→契約 LT
            </CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {avgDealLT !== null ? `${avgDealLT}日` : "-"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              契約日 - 商談化日の平均
              {dealLTs.length > 0 && `（${dealLTs.length}社）`}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
