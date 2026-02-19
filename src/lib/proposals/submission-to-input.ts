/**
 * フォーム回答 → シミュレーション入力へのマッピング
 */

import { SimulationInput } from "./simulation";
import { JOB_TYPE_MAPPING, PREFECTURE_LOCATION_MAP } from "./simulation-config";

type SubmissionData = {
  companyName: string;
  pastRecruitingCostAgency: number | null;
  pastRecruitingCostAds: number | null;
  pastRecruitingCostReferral: number | null;
  pastRecruitingCostOther: number | null;
  pastHiringCount: number | null;
  desiredJobTypes: string | null; // JSON文字列
  annualHiringTarget: number | null;
  hiringAreas: string | null; // JSON文字列
};

/**
 * JSON文字列を配列にパース
 */
function parseJsonArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 都道府県名から勤務地係数用のロケーション名を取得
 */
function prefectureToLocation(prefecture: string): string {
  // PREFECTURE_LOCATION_MAPに直接都道府県名があればそのまま使う
  if (PREFECTURE_LOCATION_MAP[prefecture] !== undefined) {
    return prefecture;
  }

  // 都/府/県を補完して再検索
  const suffixes = ["都", "府", "県"];
  for (const suffix of suffixes) {
    const withSuffix = prefecture + suffix;
    if (PREFECTURE_LOCATION_MAP[withSuffix] !== undefined) {
      return withSuffix;
    }
  }

  return prefecture;
}

/**
 * 都道府県名から直接係数を取得
 */
export function getPrefectureCoefficient(prefecture: string): number {
  const location = prefectureToLocation(prefecture);
  return PREFECTURE_LOCATION_MAP[location] ?? 1.1; // デフォルトはやや難
}

/**
 * StpLeadFormSubmission → SimulationInput へのマッピング
 */
export function submissionToSimulationInput(submission: SubmissionData): SimulationInput {
  const desiredJobTypes = parseJsonArray(submission.desiredJobTypes);
  const hiringAreas = parseJsonArray(submission.hiringAreas);

  // 最初の職種からGAS用の職種名・業界を判定
  const firstJobType = desiredJobTypes[0] || "";
  const mapping = JOB_TYPE_MAPPING[firstJobType] || { jobType: "営業", industry: "一般サービス業" };

  // 最初のエリアからロケーションを判定
  const firstArea = hiringAreas[0] || "";
  const location = prefectureToLocation(firstArea);

  return {
    companyName: submission.companyName,
    jobType: mapping.jobType,
    industry: mapping.industry,
    location,
    recruitmentAgencyCost: submission.pastRecruitingCostAgency || 0,
    jobAdCost: submission.pastRecruitingCostAds || 0,
    referralCost: submission.pastRecruitingCostReferral || 0,
    otherCost: submission.pastRecruitingCostOther || 0,
    annualHires: submission.pastHiringCount || 24,
    targetHires: submission.annualHiringTarget || 12,
    salaryLevel: "平均±10%", // デフォルト
  };
}
