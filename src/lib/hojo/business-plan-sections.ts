// 事業計画書（Claude API 生成 PDF）のセクション定義とプロンプト組み立て。
// 日本語15〜20ページ相当（合計 約 20,000〜25,000 字）を目標にする。

export type BusinessPlanSectionKey =
  | "executiveSummary"
  | "companyProfile"
  | "businessContent"
  | "mainProductService"
  | "businessStrength"
  | "openingBackground"
  | "businessScale"
  | "targetMarket"
  | "targetCustomerProfile"
  | "competitors"
  | "strengthsAndChallenges"
  | "supportPurpose"
  | "supportGoal"
  | "investmentPlan"
  | "expectedOutcome"
  | "businessStructure"
  | "goalsShortMidLong"
  | "salesStrategy"
  | "financialPlan"
  | "conclusion";

export type BusinessPlanSectionDef = {
  key: BusinessPlanSectionKey;
  title: string;
  targetChars: number;
  instruction: string;
};

export const BUSINESS_PLAN_SECTIONS: BusinessPlanSectionDef[] = [
  {
    key: "executiveSummary",
    title: "1. エグゼクティブサマリー",
    targetChars: 900,
    instruction:
      "事業計画書全体を俯瞰する要約。事業者の屋号・代表者・事業内容の核心・支援制度を活用する目的・期待される成果を簡潔にまとめる。",
  },
  {
    key: "companyProfile",
    title: "2. 事業者情報",
    targetChars: 700,
    instruction:
      "屋号・代表者氏名・開業年月日・所在地・連絡先・従業員数・ホームページ（あれば）を紹介し、事業者のプロフィールとして読みやすくまとめる。",
  },
  {
    key: "businessContent",
    title: "3. 事業内容",
    targetChars: 1200,
    instruction:
      "どのような事業を展開しているか、提供価値・事業モデル・業界での立ち位置を詳しく説明する。",
  },
  {
    key: "mainProductService",
    title: "4. 主力商品・サービス",
    targetChars: 1100,
    instruction:
      "主力商品・サービスの内容と特徴、価格帯、顧客にもたらす価値を具体的に記述する。",
  },
  {
    key: "businessStrength",
    title: "5. 事業の強みと差別化ポイント",
    targetChars: 1100,
    instruction:
      "他社と比較した際の優位性、独自の仕組みやノウハウ、継続受注につながる仕掛けを記述する。",
  },
  {
    key: "openingBackground",
    title: "6. 開業の経緯と事業にかける想い",
    targetChars: 900,
    instruction:
      "なぜこの事業を始めたのか、原体験・想い・ビジョンをストーリー仕立てで書く。未記入の場合は事業内容や強みから推測して肯定的に補完する。",
  },
  {
    key: "businessScale",
    title: "7. 事業規模の現状",
    targetChars: 700,
    instruction:
      "昨年度の売上高・月間売上の目安・顧客数など現状の事業規模を客観的に記載する。",
  },
  {
    key: "targetMarket",
    title: "8. ターゲット市場",
    targetChars: 900,
    instruction:
      "ターゲットとしている市場の規模感、成長性、マクロ動向、この市場を選ぶ理由を記述する。",
  },
  {
    key: "targetCustomerProfile",
    title: "9. ターゲット顧客層",
    targetChars: 1000,
    instruction:
      "属性（年齢・性別・地域・職業）、課題・ニーズ、情報収集手段、意思決定の傾向を詳述する。",
  },
  {
    key: "competitors",
    title: "10. 競合分析",
    targetChars: 800,
    instruction:
      "主な競合（店舗・サービス・企業）を挙げ、自社と競合の差異点を比較する。未記入の場合は業界一般論で補完する。",
  },
  {
    key: "strengthsAndChallenges",
    title: "11. 自社の強みと今後の課題",
    targetChars: 1000,
    instruction:
      "自社の優位性と、現在認識している課題（人材・体制・集客・オペレーション）、課題に対する改善方針を記述する。",
  },
  {
    key: "supportPurpose",
    title: "12. 支援制度活用の目的",
    targetChars: 900,
    instruction:
      "なぜこの支援制度を活用するのか、自社課題との結びつきを明確に書く。",
  },
  {
    key: "supportGoal",
    title: "13. 支援制度で実現したいこと",
    targetChars: 1100,
    instruction:
      "具体的な取り組み内容、業務・体制・サービスの改善点、期待される成果、事業への波及効果を記述する。",
  },
  {
    key: "investmentPlan",
    title: "14. 投資・設備導入計画",
    targetChars: 1100,
    instruction:
      "支援制度を活用した投資内容・導入スケジュール・自社課題との関連性・実行体制を記述する。",
  },
  {
    key: "expectedOutcome",
    title: "15. 期待される成果",
    targetChars: 1000,
    instruction:
      "売上増加の見込み、業務効率化、雇用・組織への影響、中長期的な波及効果を具体的数値や根拠と共に述べる。",
  },
  {
    key: "businessStructure",
    title: "16. 事業体制とご経歴",
    targetChars: 1000,
    instruction:
      "事業主の経歴・スキル・資格、スタッフがいれば役割、今後必要な人材・採用計画を記述する。",
  },
  {
    key: "goalsShortMidLong",
    title: "17. 事業計画（短期・中期・長期目標）",
    targetChars: 1300,
    instruction:
      "短期（1年以内）・中期（3年）・長期（5年）の目標をそれぞれサブ見出し付きで記述する。",
  },
  {
    key: "salesStrategy",
    title: "18. 販売戦略とPR計画",
    targetChars: 1100,
    instruction:
      "ターゲット顧客への販売戦略、具体的な集客・マーケティング手法、強みの訴求方法、継続売上の仕組みを記述する。",
  },
  {
    key: "financialPlan",
    title: "19. 財務計画",
    targetChars: 1300,
    instruction:
      "過去の事業実績・今後の投資計画と必要資金・資金調達方法（自己資金・借入・補助金）・借入状況・担保・保証情報を整理する。",
  },
  {
    key: "conclusion",
    title: "20. まとめ",
    targetChars: 700,
    instruction:
      "事業計画全体を総括し、この事業と支援制度活用を通じて実現したい未来像を力強く締める。",
  },
];

export const TOTAL_TARGET_CHARS = BUSINESS_PLAN_SECTIONS.reduce((s, v) => s + v.targetChars, 0);

// セクション定義文字列を組み立て（プロンプト本文のプレースホルダー展開用）
export function buildSectionSpec(): string {
  return BUSINESS_PLAN_SECTIONS.map(
    (s) => `  - key: "${s.key}" / タイトル: "${s.title}" / 目安: ${s.targetChars}字\n    指示: ${s.instruction}`,
  ).join("\n");
}

// プレースホルダー置換（ {{sectionSpec}} と {{totalChars}} を展開）
export function applyPromptPlaceholders(template: string): string {
  const sectionSpec = buildSectionSpec();
  return template
    .replace(/\{\{sectionSpec\}\}/g, sectionSpec)
    .replace(/\{\{totalChars\}\}/g, String(TOTAL_TARGET_CHARS));
}

/**
 * Claude の System プロンプトを DB から読み込んでプレースホルダーを展開して返す。
 * HojoBusinessPlanPrompt テーブルに保存されたテンプレートを使用。
 * DB に未保存（ありえないが）の場合はフォールバックで既定値を使う。
 */
export async function buildSystemPrompt(): Promise<string> {
  const { prisma } = await import("@/lib/prisma");
  const tpl = await prisma.hojoBusinessPlanPrompt.findFirst({
    orderBy: { id: "asc" },
  });
  const body = tpl?.promptBody ?? DEFAULT_BUSINESS_PLAN_PROMPT_BODY;
  return applyPromptPlaceholders(body);
}

// マイグレーションで DB に投入するデフォルトプロンプト本文と同じ（フォールバック用）
export const DEFAULT_BUSINESS_PLAN_PROMPT_BODY = `あなたは日本の中小企業向け事業計画書の作成専門家です。
以下のルールに従い、事業計画書を「申請者の記入内容」に基づいて執筆してください。

## 出力フォーマット
厳密に以下の JSON のみを出力してください。前後に説明文や \`\`\` のコードフェンスを付けないこと。

{
  "sections": {
    "executiveSummary": "本文…",
    "companyProfile": "本文…",
    ... 以下20セクション全て
  }
}

## 執筆ルール
- 全セクションの合計で日本語15〜20ページ相当（約 {{totalChars}} 字前後）を目指す。
- 各セクションの目安字数を大きく下回らない／上回らないこと。
- 申請者の記入内容を尊重し、誇張や虚偽は書かない。記入不足の箇所は一般論で自然に補う。
- です・ます調の丁寧な文語体。見出しは付けず本文のみ。段落で論理構造を示す。
- 数字・固有名詞は申請者情報をそのまま使う。
- ビジネス的に前向きで、審査者が納得しやすい論拠と流れを意識する。

## セクション定義
{{sectionSpec}}

## 出力の JSON キー
セクション key は上記の20個。漏れや追加は禁止。`;

// 申請者の記入内容を整形してユーザーメッセージに乗せる
export function buildUserMessage(applicantData: Record<string, string>): string {
  const safe = (k: string) => applicantData[k] || "（記入なし）";
  return `申請者の記入内容（情報回収フォーム回答）:

【基本情報】
屋号: ${safe("tradeName")}
開業年月日: ${safe("openingDate")}
代表者氏名: ${safe("fullName")}
所在地: ${safe("officeAddress")}
電話番号: ${safe("phone")}
メール: ${safe("email")}
従業員数: ${safe("employeeCount")}
ホームページURL: ${safe("homepageUrl")}

【事業概要】
事業内容: ${safe("businessContent")}
主力商品・サービス: ${safe("mainProductService")}
事業の強み・差別化ポイント: ${safe("businessStrength")}
開業の経緯・想い: ${safe("openingBackground")}
現状の事業規模: ${safe("businessScale")}

【市場・競合】
ターゲット市場: ${safe("targetMarket")}
ターゲット顧客層: ${safe("targetCustomerProfile")}
競合する相手: ${safe("competitors")}
強みと今後の課題: ${safe("strengthsAndChallenges")}

【支援制度申請関連】
支援制度の目的: ${safe("supportPurpose")}
実現したいこと: ${safe("supportGoal")}
具体的計画: ${safe("investmentPlan")}
期待される成果: ${safe("expectedOutcome")}

【事業体制・経歴】
事業主の経歴・スキル・資格: ${safe("ownerCareer")}
スタッフの役割: ${safe("staffRoles")}
今後必要な人材: ${safe("futureHiring")}

【事業計画】
短期（1年）の目標: ${safe("shortTermGoal")}
中期（3年）の目標: ${safe("midTermGoal")}
長期（5年）の目標: ${safe("longTermGoal")}
販売戦略・PR計画: ${safe("salesStrategy")}

【財務情報】
今後の投資計画・必要資金: ${safe("futureInvestmentPlan")}
借入状況・担保・保証情報: ${safe("debtInfo")}

上記の記入内容を元に、システムプロンプトの指示通り JSON を出力してください。`;
}

// Claude 応答テキストから JSON を抽出して各セクションを検証する。
// 応答が途中で切れた場合のデバッグ性を重視し、失敗時は原文の先頭を含めてthrowする。
export function parseSectionsJson(
  text: string,
): Record<BusinessPlanSectionKey, string> {
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: { sections?: Record<string, string> };
  try {
    parsed = JSON.parse(cleaned) as { sections?: Record<string, string> };
  } catch (e) {
    const head = cleaned.slice(0, 300);
    const tail = cleaned.length > 600 ? "…" + cleaned.slice(-200) : "";
    const orig = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Claude応答のJSONパースに失敗しました（max_tokensで切れた可能性あり）: ${orig}\n応答冒頭: ${head}${tail}`,
    );
  }

  const sections = parsed.sections ?? {};
  const missing: string[] = [];
  const result: Record<string, string> = {};
  for (const def of BUSINESS_PLAN_SECTIONS) {
    const body = sections[def.key];
    if (typeof body !== "string" || !body.trim()) {
      missing.push(def.key);
      continue;
    }
    result[def.key] = body.trim();
  }
  if (missing.length > 0) {
    throw new Error(`Claude応答のセクションが不足しています: ${missing.join(", ")}`);
  }
  return result as Record<BusinessPlanSectionKey, string>;
}
