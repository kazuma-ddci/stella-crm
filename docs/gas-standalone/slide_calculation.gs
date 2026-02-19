/**
 * 採用ブースト 提案スライド自動生成システム（スタンドアロン版）
 * シミュレーション計算ロジック
 */

/**
 * フォームデータからシミュレーション結果を計算
 * @param {Object} formData - フォームから取得したデータ
 * @returns {Object} 計算結果
 */
function sb_calculateSimulation(formData) {
  // ========================================
  // Before（現状コスト）の計算
  // ========================================
  const before = sb_calculateBefore(formData);

  // ========================================
  // 係数の計算
  // ========================================
  const coefficients = sb_calculateCoefficients(formData);

  // ========================================
  // 目標採用人数
  // ========================================
  const targetHires = sb_parseNumber(formData.targetHires) || 12;

  // Before合計採用コスト = 年間採用単価 × 目標採用人数
  const totalCostForTarget = before.costPerHire * targetHires;

  // ========================================
  // 応募単価の中央値（係数適用済み）
  // ========================================
  const performance = sb_getTargetPerformance(formData.industry);
  const adjustedMedian = performance.median * coefficients.total;

  // ========================================
  // 10%シナリオ（応募→採用 変換率10%）
  // ========================================
  const scenario10 = sb_calculateScenario(adjustedMedian, 10, targetHires, totalCostForTarget);

  // ========================================
  // 20%シナリオ（応募→採用 変換率20%）
  // ========================================
  const scenario20 = sb_calculateScenario(adjustedMedian, 5, targetHires, totalCostForTarget);

  return {
    companyName: formData.companyName || '御社',
    jobType: formData.jobType || formData.industry || '',
    targetHires: targetHires,
    before: {
      annualCost: before.annualCost,
      costPerHire: before.costPerHire,
      annualHires: before.annualHires,
      totalCostForTarget: totalCostForTarget,
    },
    scenario10: scenario10,
    scenario20: scenario20,
  };
}

/**
 * シナリオ別の計算（10%/20%共通）
 * @param {number} adjustedMedian - 係数適用済み応募単価の中央値
 * @param {number} multiplier - 10（採用率10%）or 5（採用率20%）
 * @param {number} targetHires - 目標採用人数
 * @param {number} beforeTotalCost - Before合計採用コスト
 */
function sb_calculateScenario(adjustedMedian, multiplier, targetHires, beforeTotalCost) {
  // 月の採用人数 = 広告予算10万 ÷ (係数適用済み中央値 × multiplier)
  const hireCost = adjustedMedian * multiplier;
  const monthlyHires = hireCost > 0 ? SB_PRICING.AD_COST_MONTHLY / hireCost : 0;

  // 予想期間 = ceil(目標採用人数 ÷ 月の採用人数) + 1
  const months = monthlyHires > 0 ? Math.ceil(targetHires / monthlyHires) + 1 : 0;

  // 成果報酬型 = 初期費用 + (予想期間 × 広告予算) + (目標人数 × 成果報酬)
  const successFeeCost = SB_PRICING.INITIAL_FEE
    + (months * SB_PRICING.AD_COST_MONTHLY)
    + (targetHires * SB_PRICING.SUCCESS_FEE_PER_HIRE);

  // 月額固定型 = 初期費用 + (予想期間 × 広告予算) + (予想期間 × 月額費用)
  const monthlyFeeCost = SB_PRICING.INITIAL_FEE
    + (months * SB_PRICING.AD_COST_MONTHLY)
    + (months * SB_PRICING.MONTHLY_FEE);

  // 削減率 = (before合計 - after合計) ÷ before合計 × 100
  const reductionSuccess = beforeTotalCost > 0
    ? Math.round((beforeTotalCost - successFeeCost) / beforeTotalCost * 100)
    : 0;
  const reductionMonthly = beforeTotalCost > 0
    ? Math.round((beforeTotalCost - monthlyFeeCost) / beforeTotalCost * 100)
    : 0;

  return {
    monthlyHires: monthlyHires,
    months: months,
    successFeeCost: successFeeCost,
    monthlyFeeCost: monthlyFeeCost,
    reductionSuccess: reductionSuccess,
    reductionMonthly: reductionMonthly,
  };
}

/**
 * Before（現状コスト）を計算
 */
function sb_calculateBefore(formData) {
  const recruitmentAgencyCost = sb_parseNumber(formData.recruitmentAgencyCost) || 0;
  const jobAdCost = sb_parseNumber(formData.jobAdCost) || 0;
  const referralCost = sb_parseNumber(formData.referralCost) || 0;
  const otherCost = sb_parseNumber(formData.otherCost) || 0;

  const totalCost = recruitmentAgencyCost + jobAdCost + referralCost + otherCost;

  const annualHires = sb_parseNumber(formData.annualHires) || 24;

  const costPerHire = annualHires > 0 ? Math.round(totalCost / annualHires) : 0;

  return {
    costPerHire: costPerHire,
    annualHires: annualHires,
    annualCost: totalCost,
    costPerHireFormatted: sb_formatCurrency(costPerHire) + '/名',
    annualHiresFormatted: annualHires + '名/年',
    annualCostFormatted: sb_formatCurrencyMan(totalCost) + '万円',
  };
}

/**
 * 係数を計算
 */
function sb_calculateCoefficients(formData) {
  const industryCoef = sb_getCoefficient(formData.industry, SB_INDUSTRY_COEFFICIENTS);
  const jobCoef = sb_getCoefficient(formData.jobType, SB_JOB_COEFFICIENTS);
  const locationCoef = sb_getCoefficient(formData.location, SB_LOCATION_COEFFICIENTS);
  const headcountCoef = sb_getHeadcountCoefficient(sb_parseNumber(formData.targetHires) || 12);

  const salaryCoef = formData.salaryLevel
    ? sb_getCoefficient(formData.salaryLevel, SB_SALARY_COEFFICIENTS)
    : 1.0;

  const totalCoef = industryCoef * jobCoef * salaryCoef * locationCoef * headcountCoef;

  return {
    industry: industryCoef,
    job: jobCoef,
    salary: salaryCoef,
    location: locationCoef,
    headcount: headcountCoef,
    total: totalCoef,
  };
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * 文字列を数値に変換
 * 対応形式: 1000000, 100万円, 約500万円, 500万, 24人, 3名 等
 */
function sb_parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  let str = String(value);

  // 前処理: 「約」とカンマを除去
  str = str.replace(/約/g, '');
  str = str.replace(/[,，]/g, '');

  if (str.includes('万')) {
    const match = str.match(/([0-9.]+)\s*万/);
    if (match) {
      const num = parseFloat(match[1]);
      return isNaN(num) ? 0 : Math.round(num * 10000);
    }
  }

  const cleaned = str.replace(/[円¥人名]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * 金額をフォーマット（円）
 */
function sb_formatCurrency(value) {
  if (!value && value !== 0) return '-';
  return value.toLocaleString('ja-JP') + '円';
}

/**
 * 金額をフォーマット（万円）
 */
function sb_formatCurrencyMan(value) {
  if (!value && value !== 0) return '-';
  return Math.round(value / 10000);
}
