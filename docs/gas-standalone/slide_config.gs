/**
 * 採用ブースト 提案スライド自動生成システム（スタンドアロン版）
 * 設定ファイル
 *
 * 1つのスプレッドシート + Googleフォームで完結する構成。
 * フォーム送信 → onFormSubmit → スライド生成 の流れ。
 */

// ============================================
// テンプレート・フォルダ設定
// ============================================
const SB_CONFIG = {
  // GoogleスライドテンプレートのID（要設定）
  SLIDE_TEMPLATE_ID: 'YOUR_TEMPLATE_ID_HERE',

  // 生成したスライドの保存先フォルダID（空の場合はマイドライブ直下）
  OUTPUT_FOLDER_ID: '',

  // シート設定
  HEARING_SHEET_NAME: 'フォームの回答 1', // Googleフォームのデフォルトシート名（必要に応じて変更）
  PROCESSED_HEADER: '処理済み',
  SLIDE_URL_HEADER: '提案書URL',
};

// ============================================
// 固定料金設定（単位: 円）
// ============================================
const SB_PRICING = {
  // 初期費用
  INITIAL_FEE: 100000,

  // 広告費（月額）
  AD_COST_MONTHLY: 100000,

  // 成果報酬（1採用あたり）
  SUCCESS_FEE_PER_HIRE: 150000,

  // 月額固定費用
  MONTHLY_FEE: 150000,
};

// ============================================
// 業界係数
// ============================================
const SB_INDUSTRY_COEFFICIENTS = {
  // 易しい（0.9）
  '小売': 0.9,
  'コールセンター': 0.9,

  // 標準（1.0）
  '一般サービス業': 1.0,
  'メーカー': 1.0,
  '飲食': 1.0,

  // やや難（1.1）
  'IT': 1.1,
  'WEB': 1.1,
  '専門系': 1.1,
  '金融': 1.1,
  'SES': 1.1,

  // 難しい（1.2）
  '介護': 1.2,
  '建設': 1.2,
  '建築系': 1.2,
  'ドライバー': 1.2,
  '運送・物流': 1.2,
  'タクシー': 1.2,
  '訪問販売': 1.2,
  '製造': 1.2,
  '警備': 1.2,
};

// ============================================
// 職種係数
// ============================================
const SB_JOB_COEFFICIENTS = {
  // 易しい（0.9）
  '事務': 0.9,
  '受付': 0.9,
  '販売': 0.9,

  // 標準（1.0）
  '営業': 1.0,
  'CS': 1.0,
  'カスタマーサクセス': 1.0,
  '軽作業': 1.0,
  'マーケティング': 1.0,

  // やや難（1.1）
  'IT営業': 1.1,
  '警備': 1.1,
  'エンジニア': 1.1,

  // 難しい（1.2）
  '管理職': 1.2,
  'データ系': 1.2,
  '専門職': 1.2,
  '介護': 1.2,
  '建設': 1.2,
  '施工管理': 1.2,
  'ドライバー': 1.2,
  '製造': 1.2,
};

// ============================================
// 給与係数
// ============================================
const SB_SALARY_COEFFICIENTS = {
  '市場平均より高い': 0.9,
  '平均±10%': 1.0,
  '平均-10〜20%': 1.1,
  '平均-20%以上': 1.2,
};

// ============================================
// 勤務地係数
// ============================================
const SB_LOCATION_COEFFICIENTS = {
  // 易しい（0.9）- 都市部・駅近・在宅
  '東京': 0.9,
  '在宅': 0.9,
  '駅近': 0.9,

  // 標準（1.0）- 都市近郊
  '埼玉': 1.0,
  '神奈川': 1.0,
  '千葉': 1.0,
  '大阪': 1.0,
  '福岡': 1.0,
  '愛知': 1.0,
  '名古屋': 1.0,

  // やや難（1.1）- 郊外・車通勤
  '郊外': 1.1,
  '車通勤': 1.1,

  // 難しい（1.2）- 過疎地域・僻地
  '地方': 1.2,
  '過疎地域': 1.2,
};

// ============================================
// 採用人数係数
// ============================================
const SB_HEADCOUNT_COEFFICIENTS = {
  '1-2': 1.3,   // 1〜2人
  '3-5': 1.15,  // 3〜5人
  '6-10': 1.0,  // 6〜10人
  '11-20': 0.9, // 11〜20人
  '21+': 0.8,   // 21人以上
};

// ============================================
// ターゲット業界の運用後実績（応募単価の範囲）
// ============================================
const SB_TARGET_PERFORMANCE = {
  // Aランク（最優先ターゲット）
  '建築系': { min: 5000, max: 15000 },
  '施工管理': { min: 5000, max: 15000 },
  '運送・物流': { min: 7000, max: 15000 },
  'ドライバー': { min: 7000, max: 15000 },
  'タクシー': { min: 5000, max: 12000 },
  '小売販売': { min: 2000, max: 6000 },
  '携帯販売': { min: 3000, max: 10000 },
  'SES': { min: 3000, max: 6000 },
  '警備': { min: 4000, max: 13000 },
  'コールセンター': { min: 3000, max: 7000 },

  // Bランク（準優先ターゲット）
  '人材派遣': { min: 5000, max: 10000 },
  '飲食': { min: 3000, max: 7000 },
  'ホテル': { min: 8000, max: 15000 },
  '旅館': { min: 8000, max: 15000 },
  '清掃': { min: 7000, max: 12000 },
  '引越し': { min: 8000, max: 15000 },
  '不動産': { min: 4000, max: 8000 },
  'ITベンチャー': { min: 2000, max: 5000 },
  '製造': { min: 8000, max: 20000 },

  // デフォルト（該当なし）
  'default': { min: 5000, max: 10000 },
};

/**
 * 係数を取得するヘルパー関数
 */
function sb_getCoefficient(value, coefficientMap) {
  if (!value) return 1.0;

  // 完全一致を探す
  if (coefficientMap[value]) {
    return coefficientMap[value];
  }

  // 部分一致を探す
  for (const key in coefficientMap) {
    if (value.includes(key) || key.includes(value)) {
      return coefficientMap[key];
    }
  }

  // デフォルト
  return 1.0;
}

/**
 * 採用人数から係数を取得
 */
function sb_getHeadcountCoefficient(count) {
  if (count <= 2) return SB_HEADCOUNT_COEFFICIENTS['1-2'];
  if (count <= 5) return SB_HEADCOUNT_COEFFICIENTS['3-5'];
  if (count <= 10) return SB_HEADCOUNT_COEFFICIENTS['6-10'];
  if (count <= 20) return SB_HEADCOUNT_COEFFICIENTS['11-20'];
  return SB_HEADCOUNT_COEFFICIENTS['21+'];
}

/**
 * 業界から運用後実績（応募単価）を取得
 */
function sb_getTargetPerformance(industry) {
  let perf;
  if (!industry) {
    perf = SB_TARGET_PERFORMANCE['default'];
  } else if (SB_TARGET_PERFORMANCE[industry]) {
    perf = SB_TARGET_PERFORMANCE[industry];
  } else {
    perf = SB_TARGET_PERFORMANCE['default'];
    for (const key in SB_TARGET_PERFORMANCE) {
      if (industry.includes(key) || key.includes(industry)) {
        perf = SB_TARGET_PERFORMANCE[key];
        break;
      }
    }
  }

  return {
    min: perf.min,
    max: perf.max,
    median: (perf.min + perf.max) / 2,
  };
}

/**
 * 会社名を前株/後株で分割してフォーマット
 */
function sb_parseCompanyName(companyName) {
  if (!companyName) {
    return { line1: '', line2: '', full: '' };
  }

  const name = companyName.trim();

  const patterns = [
    { prefix: true, keyword: '株式会社' },
    { prefix: false, keyword: '株式会社' },
    { prefix: true, keyword: '有限会社' },
    { prefix: false, keyword: '有限会社' },
    { prefix: true, keyword: '合同会社' },
    { prefix: false, keyword: '合同会社' },
  ];

  for (const p of patterns) {
    if (p.prefix && name.startsWith(p.keyword)) {
      return {
        line1: p.keyword,
        line2: name.replace(new RegExp('^' + p.keyword), '').trim(),
        full: name,
      };
    }
    if (!p.prefix && name.endsWith(p.keyword)) {
      return {
        line1: name.replace(new RegExp(p.keyword + '$'), '').trim(),
        line2: p.keyword,
        full: name,
      };
    }
  }

  return { line1: name, line2: '', full: name };
}
