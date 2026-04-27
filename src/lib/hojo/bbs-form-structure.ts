// BBS社が運用しているGoogleフォーム「中小企業デジタル促進支援制度に伴う事業計画書作成のための情報回収フォーム」
// の構造をそのまま定義する。BBS社向け画面・CSVはこの構造で表示・出力する。
// 値（id / title / type / required）はBBS社のGoogleフォーム実体に合わせる。

export type BbsFormItemType = "PAGE_BREAK" | "TEXT" | "PARAGRAPH_TEXT" | "DATE";

export type BbsFormItem = {
  id: number;
  title: string;
  type: BbsFormItemType;
  required?: boolean;
};

export const BBS_FORM_TITLE =
  "中小企業デジタル促進支援制度に伴う事業計画書作成のための情報回収フォーム";

export const BBS_FORM_DESCRIPTION =
  "事業計画書を弊社で作成いたします。作成するにあたって基となる情報を下記にご記入ください。";

export const BBS_FORM_ITEMS: BbsFormItem[] = [
  { id: 726683431, title: "基本情報", type: "PAGE_BREAK" },
  { id: 389372404, title: "屋号", type: "TEXT", required: true },
  { id: 1460181513, title: "開業年月日", type: "DATE" },
  { id: 1772220239, title: "氏名", type: "TEXT", required: true },
  {
    id: 205006808,
    title: "事業所の所在地（ご自宅を事業所としている場合はその住所をご記入ください）",
    type: "PARAGRAPH_TEXT",
    required: true,
  },
  { id: 1347581937, title: "連絡先（電話番号・メールアドレス）", type: "TEXT", required: true },
  { id: 575795583, title: "従業員数（ご自身を含めた人数）", type: "TEXT", required: true },

  { id: 1525294138, title: "事業概要", type: "PAGE_BREAK" },
  { id: 254991770, title: "事業内容（どのような事業をされていますか？）", type: "PARAGRAPH_TEXT", required: true },
  { id: 1652493897, title: "主力商品・サービスの内容", type: "PARAGRAPH_TEXT", required: true },
  { id: 2077882169, title: "事業の特徴や強み（差別化ポイント）", type: "PARAGRAPH_TEXT", required: true },
  { id: 1124607709, title: "開業の経緯や、この事業にかける想い", type: "PARAGRAPH_TEXT" },
  {
    id: 1970135156,
    title: "現状の事業規模（昨年度の売上高、おおよその月間売上、顧客数など）",
    type: "PARAGRAPH_TEXT",
    required: true,
  },

  { id: 46762289, title: "市場・競合情報 ", type: "PAGE_BREAK" },
  { id: 956388090, title: "ターゲットとしている市場やお客様について", type: "PARAGRAPH_TEXT" },
  { id: 731850065, title: "ターゲット顧客層（年齢・性別・地域・嗜好など）", type: "PARAGRAPH_TEXT", required: true },
  { id: 1224362341, title: "競合する相手（お店やサービスなど）", type: "PARAGRAPH_TEXT" },
  { id: 1200192249, title: "ご自身の事業の強みと、今後の課題だと感じていること", type: "PARAGRAPH_TEXT", required: true },

  { id: 1498829773, title: "支援制度申請関連", type: "PAGE_BREAK" },
  { id: 588888409, title: "支援制度の目的", type: "PARAGRAPH_TEXT", required: true },
  { id: 1827241706, title: "支援制度を活用して実現したいこと", type: "PARAGRAPH_TEXT", required: true },
  { id: 1665428177, title: "支援制度による投資・設備導入・採用など具体的計画", type: "PARAGRAPH_TEXT", required: true },
  {
    id: 576526866,
    title: "期待される成果（売上を〇%向上、新しい顧客層の獲得、作業効率の改善など）",
    type: "PARAGRAPH_TEXT",
    required: true,
  },

  { id: 1516566771, title: "事業体制とご経歴", type: "PAGE_BREAK" },
  { id: 75089194, title: "事業主（あなた）のこれまでの経歴や、現在の事業に活かせるスキル・資格", type: "PARAGRAPH_TEXT" },
  { id: 1908521364, title: "スタッフがいる場合、その方の役割", type: "PARAGRAPH_TEXT" },
  { id: 1858681909, title: "今後、どのような人材が必要ですか？（採用予定など）", type: "PARAGRAPH_TEXT" },

  { id: 1838431127, title: "事業計画", type: "PAGE_BREAK" },
  { id: 475571685, title: "短期（1年以内）の目標", type: "PARAGRAPH_TEXT", required: true },
  { id: 896310149, title: "中期（3年）の目標", type: "PARAGRAPH_TEXT", required: true },
  { id: 1381337108, title: "長期（5年）の目標", type: "TEXT", required: true },
  { id: 1015677610, title: "目標達成のための販売戦略やPR計画", type: "PARAGRAPH_TEXT", required: true },

  { id: 919379479, title: "財務情報 ", type: "PAGE_BREAK" },
  {
    id: 1599466559,
    title:
      "過去の事業実績（売上・経費・所得などがわかるもの）\n（確定申告書の控えなどで構いません。過去1〜3年分）",
    type: "PARAGRAPH_TEXT",
    required: true,
  },
  { id: 199674191, title: "今後の投資計画と、必要な資金について", type: "PARAGRAPH_TEXT", required: true },
  { id: 1123655335, title: "借入状況・担保・保証情報", type: "PARAGRAPH_TEXT" },
];

// CSVのヘッダー生成・回答変換に使う「質問項目だけ」の配列（PAGE_BREAKを除外）。
export const BBS_FORM_QUESTIONS: BbsFormItem[] = BBS_FORM_ITEMS.filter(
  (i) => i.type !== "PAGE_BREAK",
);
