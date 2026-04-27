// Stella側の HojoFormSubmission（FORM_SECTIONS構造）から
// BBS社Googleフォーム（BBS_FORM_ITEMS）の各項目に値を割り当てるリゾルバ。
// modifiedAnswers が編集済みの場合はそれを優先する（getCurrentAnswer の仕様）。
//
// マッピングに無い BBS 項目（このファイルの BBS_ITEM_RESOLVERS に id が無いもの）は
// 空文字として扱う。Stella 側にしか存在しない項目（ホームページURL・口座情報など）は
// BBS 側に出さない方針なので、ここでは扱わない。

import { getCurrentAnswer } from "./form-answer-sections";
import { BBS_FORM_QUESTIONS, type BbsFormItem } from "./bbs-form-structure";

export type FileInfo = { fileName?: string; filePath?: string };

export type BbsResolverContext = {
  answers: Record<string, unknown>;
  modifiedAnswers: Record<string, unknown> | null | undefined;
  fileUrls: Record<string, FileInfo> | null | undefined;
};

type Resolver = (ctx: BbsResolverContext) => string;

const text = (path: string, key: string): Resolver =>
  ({ answers, modifiedAnswers }) => getCurrentAnswer(answers, modifiedAnswers, path, key);

export const BBS_ITEM_RESOLVERS: Record<number, Resolver> = {
  // 基本情報
  389372404: text("basic", "tradeName"),
  1460181513: text("basic", "openingDate"),
  1772220239: text("basic", "fullName"),
  205006808: text("basic", "officeAddress"),
  1347581937: ({ answers, modifiedAnswers }) => {
    // 連絡先（電話・メール統合）: 「xxx / yyy」スラッシュ区切り
    const phone = getCurrentAnswer(answers, modifiedAnswers, "basic", "phone");
    const email = getCurrentAnswer(answers, modifiedAnswers, "basic", "email");
    if (phone && email) return `${phone} / ${email}`;
    return phone || email;
  },
  575795583: text("basic", "employeeCount"),

  // 事業概要
  254991770: text("businessOverview", "businessContent"),
  1652493897: text("businessOverview", "mainProductService"),
  2077882169: text("businessOverview", "businessStrength"),
  1124607709: text("businessOverview", "openingBackground"),
  1970135156: text("businessOverview", "businessScale"),

  // 市場・競合情報
  956388090: text("marketCompetition", "targetMarket"),
  731850065: text("marketCompetition", "targetCustomerProfile"),
  1224362341: text("marketCompetition", "competitors"),
  1200192249: text("marketCompetition", "strengthsAndChallenges"),

  // 支援制度申請関連
  588888409: text("supportApplication", "supportPurpose"),
  1827241706: text("supportApplication", "supportGoal"),
  1665428177: text("supportApplication", "investmentPlan"),
  576526866: text("supportApplication", "expectedOutcome"),

  // 事業体制とご経歴
  75089194: text("businessStructure", "ownerCareer"),
  1908521364: text("businessStructure", "staffRoles"),
  1858681909: text("businessStructure", "futureHiring"),

  // 事業計画
  475571685: text("businessPlan", "shortTermGoal"),
  896310149: text("businessPlan", "midTermGoal"),
  1381337108: text("businessPlan", "longTermGoal"),
  1015677610: text("businessPlan", "salesStrategy"),

  // 財務情報
  1599466559: text("financial", "pastBusinessRecord"),
  199674191: text("financial", "futureInvestmentPlan"),
  1123655335: text("financial", "debtInfo"),
};

export type BbsFormResponseEntry = {
  item: BbsFormItem;
  value: string;
};

export function buildBbsFormResponse(ctx: BbsResolverContext): BbsFormResponseEntry[] {
  return BBS_FORM_QUESTIONS.map((item) => ({
    item,
    value: BBS_ITEM_RESOLVERS[item.id]?.(ctx) ?? "",
  }));
}
