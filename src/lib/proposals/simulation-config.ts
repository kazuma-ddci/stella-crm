/**
 * 採用ブースト提案書 シミュレーション設定
 * GAS slide_config.gs から移植
 */

// 固定料金設定（単位: 円）
export const PRICING = {
  INITIAL_FEE: 100000,        // 初期費用
  AD_COST_MONTHLY: 100000,    // 広告費（月額）
  SUCCESS_FEE_PER_HIRE: 150000, // 成果報酬（1採用あたり）
  MONTHLY_FEE: 150000,        // 月額固定費用
} as const;

// 業界係数
export const INDUSTRY_COEFFICIENTS: Record<string, number> = {
  "小売": 0.9,
  "コールセンター": 0.9,
  "一般サービス業": 1.0,
  "メーカー": 1.0,
  "飲食": 1.0,
  "IT": 1.1,
  "WEB": 1.1,
  "専門系": 1.1,
  "金融": 1.1,
  "SES": 1.1,
  "介護": 1.2,
  "建設": 1.2,
  "建築系": 1.2,
  "ドライバー": 1.2,
  "運送・物流": 1.2,
  "タクシー": 1.2,
  "訪問販売": 1.2,
  "製造": 1.2,
  "警備": 1.2,
};

// 職種係数
export const JOB_COEFFICIENTS: Record<string, number> = {
  "事務": 0.9,
  "受付": 0.9,
  "販売": 0.9,
  "営業": 1.0,
  "CS": 1.0,
  "カスタマーサクセス": 1.0,
  "軽作業": 1.0,
  "マーケティング": 1.0,
  "IT営業": 1.1,
  "警備": 1.1,
  "エンジニア": 1.1,
  "管理職": 1.2,
  "データ系": 1.2,
  "専門職": 1.2,
  "介護": 1.2,
  "建設": 1.2,
  "施工管理": 1.2,
  "ドライバー": 1.2,
  "製造": 1.2,
};

// 給与係数
export const SALARY_COEFFICIENTS: Record<string, number> = {
  "市場平均より高い": 0.9,
  "平均±10%": 1.0,
  "平均-10〜20%": 1.1,
  "平均-20%以上": 1.2,
};

// 勤務地係数
export const LOCATION_COEFFICIENTS: Record<string, number> = {
  "東京": 0.9,
  "在宅": 0.9,
  "駅近": 0.9,
  "埼玉": 1.0,
  "神奈川": 1.0,
  "千葉": 1.0,
  "大阪": 1.0,
  "福岡": 1.0,
  "愛知": 1.0,
  "名古屋": 1.0,
  "郊外": 1.1,
  "車通勤": 1.1,
  "地方": 1.2,
  "過疎地域": 1.2,
};

// 採用人数係数
export const HEADCOUNT_COEFFICIENTS: Record<string, number> = {
  "1-2": 1.3,
  "3-5": 1.15,
  "6-10": 1.0,
  "11-20": 0.9,
  "21+": 0.8,
};

// ターゲット業界の運用後実績（応募単価の範囲）
export const TARGET_PERFORMANCE: Record<string, { min: number; max: number }> = {
  "建築系": { min: 5000, max: 15000 },
  "施工管理": { min: 5000, max: 15000 },
  "運送・物流": { min: 7000, max: 15000 },
  "ドライバー": { min: 7000, max: 15000 },
  "タクシー": { min: 5000, max: 12000 },
  "小売販売": { min: 2000, max: 6000 },
  "携帯販売": { min: 3000, max: 10000 },
  "SES": { min: 3000, max: 6000 },
  "警備": { min: 4000, max: 13000 },
  "コールセンター": { min: 3000, max: 7000 },
  "人材派遣": { min: 5000, max: 10000 },
  "飲食": { min: 3000, max: 7000 },
  "ホテル": { min: 8000, max: 15000 },
  "旅館": { min: 8000, max: 15000 },
  "清掃": { min: 7000, max: 12000 },
  "引越し": { min: 8000, max: 15000 },
  "不動産": { min: 4000, max: 8000 },
  "ITベンチャー": { min: 2000, max: 5000 },
  "製造": { min: 8000, max: 20000 },
  "default": { min: 5000, max: 10000 },
};

/**
 * CRMの職種選択肢 → GAS用の職種名・業界マッピング
 */
export const JOB_TYPE_MAPPING: Record<string, { jobType: string; industry: string }> = {
  "営業（国内・海外・法人・個人）": { jobType: "営業", industry: "一般サービス業" },
  "販売・接客・サービス（小売・飲食・宿泊・理美容など）": { jobType: "販売", industry: "小売" },
  "事務・管理（総務・人事・経理・受付・秘書など）": { jobType: "事務", industry: "一般サービス業" },
  "企画・マーケティング・広報": { jobType: "マーケティング", industry: "一般サービス業" },
  "経営・経営企画（役員・経営者を含む）": { jobType: "管理職", industry: "一般サービス業" },
  "専門職（コンサル・士業・金融など）": { jobType: "専門職", industry: "専門系" },
  "ITエンジニア（システム開発・インフラ・社内SEなど）": { jobType: "エンジニア", industry: "IT" },
  "Web・クリエイティブ（デザイン・編集・制作など）": { jobType: "エンジニア", industry: "WEB" },
  "技術職（機械・電気・電子・化学・素材など）": { jobType: "専門職", industry: "メーカー" },
  "製造・生産・品質管理": { jobType: "製造", industry: "製造" },
  "建築・土木・設備技術": { jobType: "施工管理", industry: "建築系" },
  "医療・福祉・介護": { jobType: "介護", industry: "介護" },
  "教育・保育・研究": { jobType: "専門職", industry: "一般サービス業" },
  "公務員・団体職員": { jobType: "事務", industry: "一般サービス業" },
  "物流・運送・ドライバー": { jobType: "ドライバー", industry: "運送・物流" },
  "農林水産業": { jobType: "軽作業", industry: "一般サービス業" },
  "保安・警備・清掃": { jobType: "警備", industry: "警備" },
  "その他": { jobType: "営業", industry: "一般サービス業" },
};

/**
 * 47都道府県 → 勤務地係数マッピング
 */
export const PREFECTURE_LOCATION_MAP: Record<string, number> = {
  "東京都": 0.9,
  "埼玉県": 1.0,
  "千葉県": 1.0,
  "神奈川県": 1.0,
  "大阪府": 1.0,
  "愛知県": 1.0,
  "福岡県": 1.0,
  "京都府": 1.0,
  "兵庫県": 1.0,
  "北海道": 1.1,
  "宮城県": 1.1,
  "茨城県": 1.1,
  "栃木県": 1.1,
  "群馬県": 1.1,
  "新潟県": 1.1,
  "静岡県": 1.1,
  "広島県": 1.1,
  "岡山県": 1.1,
  "熊本県": 1.1,
  "滋賀県": 1.1,
  "奈良県": 1.1,
  "三重県": 1.1,
  "長野県": 1.1,
  "岐阜県": 1.1,
  // 地方（残りの県はすべて1.2）
  "青森県": 1.2,
  "岩手県": 1.2,
  "秋田県": 1.2,
  "山形県": 1.2,
  "福島県": 1.2,
  "富山県": 1.2,
  "石川県": 1.2,
  "福井県": 1.2,
  "山梨県": 1.2,
  "和歌山県": 1.2,
  "鳥取県": 1.2,
  "島根県": 1.2,
  "山口県": 1.2,
  "徳島県": 1.2,
  "香川県": 1.2,
  "愛媛県": 1.2,
  "高知県": 1.2,
  "佐賀県": 1.2,
  "長崎県": 1.2,
  "大分県": 1.2,
  "宮崎県": 1.2,
  "鹿児島県": 1.2,
  "沖縄県": 1.2,
};

/**
 * 係数を取得するヘルパー関数（部分一致対応）
 */
export function getCoefficient(value: string | undefined | null, coefficientMap: Record<string, number>): number {
  if (!value) return 1.0;
  if (coefficientMap[value] !== undefined) return coefficientMap[value];
  for (const key of Object.keys(coefficientMap)) {
    if (value.includes(key) || key.includes(value)) {
      return coefficientMap[key];
    }
  }
  return 1.0;
}

/**
 * 採用人数から係数を取得
 */
export function getHeadcountCoefficient(count: number): number {
  if (count <= 2) return HEADCOUNT_COEFFICIENTS["1-2"];
  if (count <= 5) return HEADCOUNT_COEFFICIENTS["3-5"];
  if (count <= 10) return HEADCOUNT_COEFFICIENTS["6-10"];
  if (count <= 20) return HEADCOUNT_COEFFICIENTS["11-20"];
  return HEADCOUNT_COEFFICIENTS["21+"];
}

/**
 * 業界から運用後実績（応募単価）を取得
 */
export function getTargetPerformance(industry: string | undefined | null): { min: number; max: number; median: number } {
  let perf = TARGET_PERFORMANCE["default"];

  if (industry) {
    if (TARGET_PERFORMANCE[industry]) {
      perf = TARGET_PERFORMANCE[industry];
    } else {
      for (const key of Object.keys(TARGET_PERFORMANCE)) {
        if (key !== "default" && (industry.includes(key) || key.includes(industry))) {
          perf = TARGET_PERFORMANCE[key];
          break;
        }
      }
    }
  }

  return {
    min: perf.min,
    max: perf.max,
    median: (perf.min + perf.max) / 2,
  };
}
