/**
 * 借入申込フォーム（補助金プロジェクト）の表示用セクション定義。
 * lender 側の詳細モーダル / CSV 出力など、サーバ・クライアント両方から再利用する。
 *
 * 個人事業主フォーム: formType = "loan-individual"
 * 法人フォーム: formType = "loan-corporate"
 *
 * 法人の「実質的支配者」は可変長のため getCorporateBOSections(answers) で動的生成。
 */

export type LoanFormField = { key: string; label: string };
export type LoanFormSection = { title: string; fields: LoanFormField[] };

export const INDIVIDUAL_LOAN_SECTIONS: LoanFormSection[] = [
  {
    title: "ご契約者様の情報",
    fields: [
      { key: "ind_email", label: "メールアドレス" },
      { key: "ind_name", label: "氏名(正式名称)" },
      { key: "ind_name_kana", label: "氏名(カナ)" },
      { key: "ind_postal_code", label: "郵便番号" },
      { key: "ind_address", label: "住所" },
      { key: "ind_phone", label: "電話番号" },
      { key: "ind_birthday", label: "生年月日" },
      { key: "ind_gender", label: "性別" },
    ],
  },
  {
    title: "事業者情報",
    fields: [
      { key: "ind_business_name", label: "屋号(正式名称)" },
      { key: "ind_business_type", label: "事業内容" },
      { key: "ind_business_start", label: "事業開始年月" },
      { key: "ind_income_type", label: "所得区分" },
      { key: "ind_office_address", label: "事業所住所" },
      { key: "ind_office_phone", label: "事業所電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "ind_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "口座情報",
    fields: [
      { key: "ind_bank_name", label: "金融機関名" },
      { key: "ind_branch_name", label: "支店名" },
      { key: "ind_account_type", label: "口座種別" },
      { key: "ind_account_number", label: "口座番号" },
      { key: "ind_account_holder", label: "口座名義人カナ" },
    ],
  },
];

export const CORPORATE_LOAN_SECTIONS: LoanFormSection[] = [
  {
    title: "御社の情報",
    fields: [
      { key: "corp_email", label: "メールアドレス" },
      { key: "corp_company_name", label: "法人名称(正式名称)" },
      { key: "corp_company_name_kana", label: "法人名称(カナ)" },
      { key: "corp_postal_code", label: "法人郵便番号" },
      { key: "corp_address", label: "法人本店所在地" },
      { key: "corp_phone", label: "法人電話番号" },
    ],
  },
  {
    title: "代表者の情報",
    fields: [
      { key: "corp_rep_name", label: "代表者氏名(正式名称)" },
      { key: "corp_rep_name_kana", label: "代表者氏名(カナ)" },
      { key: "corp_rep_birthday", label: "代表者生年月日" },
      { key: "corp_rep_gender", label: "性別" },
      { key: "corp_rep_postal_code", label: "代表者郵便番号" },
      { key: "corp_rep_address", label: "代表者住所" },
      { key: "corp_rep_phone", label: "代表者電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "corp_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "口座情報",
    fields: [
      { key: "corp_bank_name", label: "金融機関名" },
      { key: "corp_branch_name", label: "支店名" },
      { key: "corp_account_type", label: "口座種別" },
      { key: "corp_account_number", label: "口座番号" },
      { key: "corp_account_holder", label: "口座名義人(カナ)" },
    ],
  },
];

/**
 * 法人「実質的支配者」セクションを answers から検出して生成する。
 * corp_bo1_name, corp_bo2_name ... が存在する限り順番に生成。
 */
export function getCorporateBOSections(
  answers: Record<string, unknown>,
): LoanFormSection[] {
  const sections: LoanFormSection[] = [];
  for (let i = 1; ; i++) {
    if (!answers[`corp_bo${i}_name`]) break;
    sections.push({
      title: `実質的支配者 ${i}人目`,
      fields: [
        { key: `corp_bo${i}_name`, label: "氏名称" },
        { key: `corp_bo${i}_name_kana`, label: "氏名称フリガナ" },
        { key: `corp_bo${i}_address`, label: "住所" },
        { key: `corp_bo${i}_share`, label: "議決権等保有割合" },
        { key: `corp_bo${i}_birthday`, label: "生年月日" },
        { key: `corp_bo${i}_gender`, label: "性別" },
      ],
    });
  }
  return sections;
}
