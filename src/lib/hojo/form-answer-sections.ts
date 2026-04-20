// 補助金 事業計画フォーム（/form/hojo-business-plan）の質問定義を一元化。
// 入力画面・閲覧画面・編集画面・CSVエクスポートすべてここを参照する。

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "radio" | "select" | "date" | "file";
  inputType?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
  options?: string[];
  helpText?: string;
  validation?: { pattern: RegExp; message: string };
  accept?: string;
};

export type SectionDef = {
  key: string;
  path: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  condition?: (a: Record<string, unknown>) => boolean;
};

export const FORM_SECTIONS: SectionDef[] = [
  {
    key: "basic",
    path: "basic",
    title: "基本情報",
    fields: [
      { key: "tradeName", label: "①屋号", required: true, placeholder: "例）山田商店" },
      { key: "openingDate", label: "②開業年月日", required: true, placeholder: "例: 2019年1月7日", helpText: "例: 2019年1月7日" },
      { key: "fullName", label: "③氏名", required: true, placeholder: "回答を入力" },
      { key: "officeAddress", label: "④事業所の所在地", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "phone", label: "⑤連絡先（電話番号）", required: true, placeholder: "回答を入力", inputType: "tel", inputMode: "tel" },
      {
        key: "email",
        label: "⑥連絡先（メールアドレス）",
        required: true,
        placeholder: "回答を入力",
        inputType: "email",
        inputMode: "email",
        validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "正しいメールアドレスを入力してください" },
      },
      { key: "employeeCount", label: "⑦従業員数（ご自身を含めた人数）", required: true, placeholder: "回答を入力", inputMode: "numeric" },
      { key: "homepageUrl", label: "⑧ホームページURL", required: true, placeholder: "回答を入力" },
    ],
  },
  {
    key: "bank-select",
    path: "bankAccount",
    title: "口座情報",
    fields: [
      {
        key: "bankType",
        label: "助成金を受ける際にご利用される金融機関",
        required: true,
        type: "radio",
        options: ["ゆうちょ銀行", "他の金融機関"],
        helpText: "1つだけマークしてください。",
      },
    ],
  },
  {
    key: "yucho",
    path: "bankAccount",
    title: "ゆうちょ銀行",
    condition: (a) => a.bankType === "ゆうちょ銀行",
    fields: [
      {
        key: "yuchoSymbol",
        label: "①記号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角5桁",
        validation: { pattern: /^\d{5}$/, message: "半角5桁の数字で入力してください" },
      },
      {
        key: "yuchoPassbookNumber",
        label: "②通帳番号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角最大8桁",
        validation: { pattern: /^\d{1,8}$/, message: "半角8桁以内の数字で入力してください" },
      },
      { key: "yuchoAccountHolder", label: "③口座名義人", required: true, placeholder: "回答を入力" },
      { key: "yuchoAccountHolderKana", label: "④口座名義人（フリガナ）", required: true, placeholder: "回答を入力" },
    ],
  },
  {
    key: "other-bank",
    path: "bankAccount",
    title: "他の金融機関",
    condition: (a) => a.bankType === "他の金融機関",
    fields: [
      { key: "otherBankName", label: "①金融機関名", required: true, placeholder: "回答を入力", helpText: "正式名称（〇〇銀行、△△信用金庫など）" },
      {
        key: "otherBankCode",
        label: "②金融機関コード",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角4桁（例：0005）",
        validation: { pattern: /^\d{4}$/, message: "半角4桁の数字で入力してください" },
      },
      { key: "otherBranchName", label: "③支店名", required: true, placeholder: "回答を入力", helpText: "正式名称（例：新宿支店）" },
      {
        key: "otherBranchCode",
        label: "④支店コード",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角3桁（例：123）",
        validation: { pattern: /^\d{3}$/, message: "半角3桁の数字で入力してください" },
      },
      { key: "otherAccountType", label: "⑤口座種別", required: true, type: "radio", options: ["普通（総合）", "当座"], helpText: "1つだけマークしてください。" },
      {
        key: "otherAccountNumber",
        label: "⑥口座番号",
        required: true,
        placeholder: "回答を入力",
        inputMode: "numeric",
        helpText: "半角7桁",
        validation: { pattern: /^\d{7}$/, message: "半角7桁の数字で入力してください" },
      },
      { key: "otherAccountHolder", label: "⑦口座名義人", required: true, placeholder: "回答を入力" },
      { key: "otherAccountHolderKana", label: "⑧口座名義人（フリガナ）", required: true, placeholder: "回答を入力" },
    ],
  },
  {
    key: "bank-screenshot",
    path: "_file",
    title: "口座情報",
    description: "口座情報（助成金を受け取る際にご利用される口座のスクリーンショットの添付）",
    fields: [
      {
        key: "bankAccountScreenshot",
        label: "口座情報のスクリーンショット",
        required: true,
        type: "file",
        helpText:
          "◎通帳がある場合：通帳表紙と表紙裏面の写しを1つのファイルにしてご提出ください。\n◎通帳がない場合：ご入力いただいた内容が記載されたページのスクリーンショットを添付してください。",
        accept: "image/*,.pdf,.doc,.docx",
      },
    ],
  },
  {
    key: "business-overview",
    path: "businessOverview",
    title: "事業概要",
    fields: [
      { key: "businessContent", label: "①事業内容", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "mainProductService", label: "②主力商品・サービスの内容", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "businessStrength", label: "③事業の特徴や強み（差別化ポイント）", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "openingBackground", label: "④開業の経緯や、この事業にかける想い", type: "textarea", placeholder: "回答を入力" },
      { key: "businessScale", label: "⑤現状の事業規模", required: true, type: "textarea", placeholder: "回答を入力" },
    ],
  },
  {
    key: "market-competition",
    path: "marketCompetition",
    title: "市場・競合情報",
    fields: [
      { key: "targetMarket", label: "①ターゲットとしている市場やお客様について", type: "textarea", placeholder: "回答を入力" },
      { key: "targetCustomerProfile", label: "②ターゲット顧客層", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "competitors", label: "③競合する相手", type: "textarea", placeholder: "回答を入力" },
      { key: "strengthsAndChallenges", label: "④ご自身の事業の強みと、今後の課題", required: true, type: "textarea", placeholder: "回答を入力" },
    ],
  },
  {
    key: "support-application",
    path: "supportApplication",
    title: "支援制度申請関連",
    fields: [
      { key: "supportPurpose", label: "①支援制度の目的", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "supportGoal", label: "②支援制度を活用して実現したいこと", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "investmentPlan", label: "③投資・設備導入・採用など具体的計画", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "expectedOutcome", label: "④期待される成果", required: true, type: "textarea", placeholder: "回答を入力" },
    ],
  },
  {
    key: "business-structure",
    path: "businessStructure",
    title: "事業体制とご経歴",
    fields: [
      { key: "ownerCareer", label: "①事業主の経歴・スキル・資格", type: "textarea", placeholder: "回答を入力" },
      { key: "staffRoles", label: "②スタッフの役割", type: "textarea", placeholder: "回答を入力" },
      { key: "futureHiring", label: "③今後必要な人材（採用予定）", type: "textarea", placeholder: "回答を入力" },
    ],
  },
  {
    key: "business-plan",
    path: "businessPlan",
    title: "事業計画",
    fields: [
      { key: "shortTermGoal", label: "①短期（1年以内）の目標", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "midTermGoal", label: "②中期（3年）の目標", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "longTermGoal", label: "③長期（5年）の目標", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "salesStrategy", label: "④目標達成のための販売戦略やPR計画", required: true, type: "textarea", placeholder: "回答を入力" },
    ],
  },
  {
    key: "financial-file",
    path: "_file",
    title: "財務情報（添付資料）",
    fields: [
      {
        key: "pastBusinessRecord",
        label: "①過去の事業実績（売上・経費・所得がわかるもの）",
        required: true,
        type: "file",
        helpText: "【確定申告書の控えなどで構いません。過去1〜3年分】",
        accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
      },
    ],
  },
  {
    key: "financial",
    path: "financial",
    title: "財務情報",
    fields: [
      { key: "futureInvestmentPlan", label: "②今後の投資計画と必要な資金", required: true, type: "textarea", placeholder: "回答を入力" },
      { key: "debtInfo", label: "③借入状況・担保・保障情報", type: "textarea", placeholder: "回答を入力" },
    ],
  },
];

export type AnswerGroupDef = {
  title: string;
  path: string;
  fields: Array<{ key: string; label: string; type?: FieldDef["type"]; options?: string[] }>;
};

// FORM_SECTIONS から path でグルーピングした閲覧/CSV用の一覧。
// ラベルは UI の ① ② ... 番号と「●の場合」修飾語をはずした簡潔版にする。
function stripUiOrnaments(label: string): string {
  return label
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]/u, "")
    .replace(/^\s+/, "");
}

export const ANSWER_GROUPS: AnswerGroupDef[] = (() => {
  const groupsByPath = new Map<string, AnswerGroupDef>();
  for (const section of FORM_SECTIONS) {
    if (section.path === "_file") continue;
    const existing = groupsByPath.get(section.path);
    const fields = section.fields
      .filter((f) => f.type !== "file")
      .map((f) => ({
        key: f.key,
        label: stripUiOrnaments(f.label),
        type: f.type,
        options: f.options,
      }));
    if (existing) {
      existing.fields.push(...fields);
    } else {
      groupsByPath.set(section.path, {
        path: section.path,
        title: section.path === "bankAccount" ? "口座情報" : section.title,
        fields,
      });
    }
  }
  return Array.from(groupsByPath.values());
})();

export const FILE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "bankAccountScreenshot", label: "口座情報スクリーンショット" },
  { key: "pastBusinessRecord", label: "過去の事業実績資料" },
];

export type SubmissionMeta = {
  uid: string | null;
  formVersion: string | null;
  formType: string | null;
  submittedAt: string | null;
};

export function extractSubmissionMeta(answers: Record<string, unknown> | null | undefined): SubmissionMeta {
  const meta = (answers?._meta as Record<string, unknown> | undefined) ?? {};
  return {
    uid: typeof meta.uid === "string" ? meta.uid : null,
    formVersion: typeof meta.formVersion === "string" ? meta.formVersion : null,
    formType: typeof meta.formType === "string" ? meta.formType : null,
    submittedAt: typeof meta.submittedAt === "string" ? meta.submittedAt : null,
  };
}

export function getAnswerValue(
  source: Record<string, unknown> | null | undefined,
  path: string,
  key: string,
): string {
  if (!source) return "";
  const section = source[path];
  if (!section || typeof section !== "object") return "";
  const v = (section as Record<string, unknown>)[key];
  return v == null ? "" : String(v);
}

export function getCurrentAnswer(
  answers: Record<string, unknown>,
  modifiedAnswers: Record<string, unknown> | null | undefined,
  path: string,
  key: string,
): string {
  const modified = getAnswerValue(modifiedAnswers ?? undefined, path, key);
  if (modified !== "") return modified;
  return getAnswerValue(answers, path, key);
}
