/**
 * 採用ブースト提案書 シミュレーション計算エンジン
 * GAS slide_calculation.gs から移植
 */

import {
  PRICING,
  INDUSTRY_COEFFICIENTS,
  JOB_COEFFICIENTS,
  SALARY_COEFFICIENTS,
  LOCATION_COEFFICIENTS,
  getCoefficient,
  getHeadcountCoefficient,
  getTargetPerformance,
} from "./simulation-config";

export type SimulationInput = {
  companyName: string;
  jobType: string;
  industry: string;
  location: string;
  recruitmentAgencyCost: number;
  jobAdCost: number;
  referralCost: number;
  otherCost: number;
  annualHires: number;
  targetHires: number;
  salaryLevel: string;
};

export type BeforeResult = {
  annualCost: number;
  costPerHire: number;
  annualHires: number;
  totalCostForTarget: number;
};

export type CoefficientsResult = {
  industry: number;
  job: number;
  salary: number;
  location: number;
  headcount: number;
  total: number;
};

export type ScenarioResult = {
  monthlyHires: number;
  months: number;
  successFeeCost: number;
  monthlyFeeCost: number;
  reductionSuccess: number;
  reductionMonthly: number;
};

export type SimulationResult = {
  before: BeforeResult;
  coefficients: CoefficientsResult;
  scenario10: ScenarioResult;
  scenario20: ScenarioResult;
};

export type SlideVersion = {
  version: number;
  slideFileId: string;
  slideUrl: string;
  embedUrl: string;
  createdAt: string;
  inputSnapshot: SimulationInput;
  resultSnapshot: SimulationResult;
  confirmedProposalId: number | null;
  deletedAt: string | null;
  editUnlockedAt: string | null;
};

export type ProposalContent = {
  input: SimulationInput;
  originalInput?: SimulationInput;
  result: SimulationResult;
  generatedAt: string;
  version: number;
  slides?: SlideVersion[];
};

/**
 * 全シミュレーション計算を実行
 */
export function calculateSimulation(input: SimulationInput): SimulationResult {
  const before = calculateBefore(input);
  const coefficients = calculateCoefficients(input);
  const totalCostForTarget = before.costPerHire * input.targetHires;

  const performance = getTargetPerformance(input.industry);
  const adjustedMedian = performance.median * coefficients.total;

  const scenario10 = calculateScenario(adjustedMedian, 10, input.targetHires, totalCostForTarget);
  const scenario20 = calculateScenario(adjustedMedian, 5, input.targetHires, totalCostForTarget);

  return {
    before: { ...before, totalCostForTarget },
    coefficients,
    scenario10,
    scenario20,
  };
}

/**
 * Before（現状コスト）の計算
 */
export function calculateBefore(input: SimulationInput): BeforeResult {
  const annualCost =
    (input.recruitmentAgencyCost || 0) +
    (input.jobAdCost || 0) +
    (input.referralCost || 0) +
    (input.otherCost || 0);

  const annualHires = input.annualHires || 24;
  const costPerHire = annualHires > 0 ? Math.round(annualCost / annualHires) : 0;

  return {
    annualCost,
    costPerHire,
    annualHires,
    totalCostForTarget: 0, // calculateSimulationで上書き
  };
}

/**
 * 5係数の算出
 */
export function calculateCoefficients(input: SimulationInput): CoefficientsResult {
  const industry = getCoefficient(input.industry, INDUSTRY_COEFFICIENTS);
  const job = getCoefficient(input.jobType, JOB_COEFFICIENTS);
  const salary = input.salaryLevel
    ? getCoefficient(input.salaryLevel, SALARY_COEFFICIENTS)
    : 1.0;
  const location = getCoefficient(input.location, LOCATION_COEFFICIENTS);
  const headcount = getHeadcountCoefficient(input.targetHires || 12);

  const total = industry * job * salary * location * headcount;

  return { industry, job, salary, location, headcount, total };
}

/**
 * シナリオ別の計算（10%/20%共通）
 * @param adjustedMedian - 係数適用済み応募単価の中央値
 * @param multiplier - 10（採用率10%）or 5（採用率20%）
 * @param targetHires - 目標採用人数
 * @param beforeTotalCost - Before合計採用コスト
 */
export function calculateScenario(
  adjustedMedian: number,
  multiplier: number,
  targetHires: number,
  beforeTotalCost: number,
): ScenarioResult {
  const hireCost = adjustedMedian * multiplier;
  const monthlyHires = hireCost > 0 ? PRICING.AD_COST_MONTHLY / hireCost : 0;

  const months = monthlyHires > 0 ? Math.ceil(targetHires / monthlyHires) + 1 : 0;

  // 成果報酬型
  const successFeeCost =
    PRICING.INITIAL_FEE +
    months * PRICING.AD_COST_MONTHLY +
    targetHires * PRICING.SUCCESS_FEE_PER_HIRE;

  // 月額固定型
  const monthlyFeeCost =
    PRICING.INITIAL_FEE +
    months * PRICING.AD_COST_MONTHLY +
    months * PRICING.MONTHLY_FEE;

  // 削減率
  const reductionSuccess =
    beforeTotalCost > 0
      ? Math.round(((beforeTotalCost - successFeeCost) / beforeTotalCost) * 100)
      : 0;
  const reductionMonthly =
    beforeTotalCost > 0
      ? Math.round(((beforeTotalCost - monthlyFeeCost) / beforeTotalCost) * 100)
      : 0;

  return {
    monthlyHires,
    months,
    successFeeCost,
    monthlyFeeCost,
    reductionSuccess,
    reductionMonthly,
  };
}
