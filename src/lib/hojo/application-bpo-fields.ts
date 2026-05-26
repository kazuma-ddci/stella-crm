export type ApplicationBpoFieldType = "text" | "textarea" | "number" | "date" | "select" | "file";
export type ApplicationBpoFieldRole = "vendor" | "staff";

export type ApplicationBpoFileInfo = {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type ApplicationBpoAttachments = Record<string, ApplicationBpoFileInfo[]>;

export type ApplicationBpoField = {
  key: string;
  column: string;
  group: string;
  label: string;
  role: ApplicationBpoFieldRole;
  type: ApplicationBpoFieldType;
  placeholder?: string;
  options?: string[];
};

const yesNoOptions = ["はい", "いいえ"];

export const APPLICATION_BPO_FIELDS: ApplicationBpoField[] = [
  { key: "requestDate", column: "A", group: "依頼", label: "依頼日", role: "vendor", type: "date", placeholder: "2026/05/01" },
  { key: "doubleCheckStatus", column: "B", group: "依頼側ダブルチェック入力", label: "正誤チェック", role: "vendor", type: "select", options: ["済み", "申請ステイ"], placeholder: "済み" },
  { key: "contactNotes", column: "C", group: "申請内容等", label: "連絡事項等", role: "vendor", type: "textarea", placeholder: "【記入例】" },
  { key: "scheduledAt", column: "D", group: "申請内容等", label: "申請予定日時", role: "vendor", type: "text", placeholder: "2026/05/01 15:00" },
  { key: "companyName", column: "E", group: "申請内容等", label: "事業者名", role: "vendor", type: "text", placeholder: "株式会社 〇〇〇" },
  { key: "applicantType", column: "F", group: "申請内容等", label: "事業体", role: "vendor", type: "select", options: ["法人", "個人事業主"], placeholder: "法人" },
  { key: "repeatType", column: "G", group: "申請内容等", label: "おかわり判定", role: "vendor", type: "select", options: ["新規", "おかわり"], placeholder: "新規" },
  { key: "repeatTypeComment", column: "G+", group: "申請内容等", label: "おかわり判定 補足コメント", role: "vendor", type: "text", placeholder: "必要な場合のみ補足を入力" },
  { key: "wageIncreaseAvailability", column: "H", group: "申請内容等", label: "賃上げ可否", role: "vendor", type: "select", options: ["可", "不可"], placeholder: "可" },
  { key: "wageIncreaseComment", column: "H+", group: "申請内容等", label: "賃上げ可否 補足コメント", role: "vendor", type: "text", placeholder: "必要な場合のみ補足を入力" },
  { key: "growthChallengeTitle", column: "I", group: "成長加速マッチング", label: "挑戦課題のタイトル", role: "vendor", type: "text", placeholder: "データ活用による売上向上戦略" },
  { key: "growthChallengeGoal", column: "J", group: "成長加速マッチング", label: "挑戦課題の解決の目標", role: "vendor", type: "textarea", placeholder: "顧客データや作業実績を統合分析し、売上向上を目指します。" },
  { key: "growthBusinessDescription", column: "K", group: "成長加速マッチング", label: "事業内容", role: "vendor", type: "textarea", placeholder: "商業施設、オフィスビル、工場などを対象に清掃・設備保守を提供する事業です。" },
  { key: "productivitySolutionPdf", column: "L", group: "省力化ナビ", label: "解決策PDF", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "vendorName", column: "M", group: "アカウント情報", label: "ベンダー", role: "vendor", type: "text", placeholder: "株式会社 □□□" },
  { key: "accountId", column: "N", group: "アカウント情報", label: "ID", role: "vendor", type: "text", placeholder: "********" },
  { key: "accountPassword", column: "O", group: "アカウント情報", label: "パスワード", role: "vendor", type: "text", placeholder: "********" },
  { key: "document1", column: "P", group: "添付書類", label: "書類①（履歴事項/本人確認）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "document2", column: "Q", group: "添付書類", label: "書類②（納税証明書）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "document3", column: "R", group: "添付書類", label: "書類③（決算書類/確定申告書）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "document4", column: "S", group: "添付書類", label: "書類④（青色/白色申告書）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "document5", column: "T", group: "添付書類", label: "書類⑤（賃金台帳）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "itStrategyPdf", column: "U", group: "IT戦略ナビwith", label: "PDF添付", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "hasEmployees", column: "V", group: "事業者情報", label: "従業員有無", role: "vendor", type: "select", options: ["従業員有り", "従業員無し"], placeholder: "従業員有り" },
  { key: "gbizTopScreenshot", column: "W", group: "gBizID", label: "TOPスクショ", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "gbizEmail", column: "X", group: "gBizID", label: "gBizIDアドレス", role: "vendor", type: "text", placeholder: "xxx@example.jp" },
  { key: "selfDeclarationId", column: "Y", group: "gBizID", label: "自己宣言ID", role: "vendor", type: "text", placeholder: "5*********" },
  { key: "establishedDate", column: "Z", group: "事業者情報", label: "開業/設立年月日", role: "vendor", type: "date", placeholder: "2020/01/01" },
  { key: "capitalText", column: "AA", group: "事業者情報", label: "資本金", role: "vendor", type: "text", placeholder: "100万円" },
  { key: "fiscalMonth", column: "AB", group: "事業者情報", label: "決算月", role: "vendor", type: "text", placeholder: "3月" },
  { key: "businessTextPatterns", column: "AC", group: "事業者情報", label: "事業内容文章（3パターン）", role: "vendor", type: "textarea", placeholder: "①当社は... ②当社は... ③当社は..." },
  { key: "salesAmount", column: "AD", group: "財務情報", label: "売上高", role: "vendor", type: "number", placeholder: "30000000" },
  { key: "grossProfit", column: "AE", group: "財務情報", label: "粗利益", role: "vendor", type: "number", placeholder: "10000000" },
  { key: "operatingProfit", column: "AF", group: "財務情報", label: "営業利益", role: "vendor", type: "number", placeholder: "1000000" },
  { key: "ordinaryProfit", column: "AG", group: "財務情報", label: "経常利益", role: "vendor", type: "number", placeholder: "1000000" },
  { key: "depreciation", column: "AH", group: "財務情報", label: "減価償却費", role: "vendor", type: "number", placeholder: "50000" },
  { key: "laborCost", column: "AI", group: "財務情報", label: "人件費", role: "vendor", type: "number", placeholder: "3000000" },
  { key: "capitalAmount", column: "AJ", group: "財務情報", label: "資本金", role: "vendor", type: "number", placeholder: "1000000" },
  { key: "businessProcessTextPatterns", column: "AK", group: "事業計画", label: "ビジネスプロセス改善に向けて文章（3パターン）", role: "vendor", type: "textarea", placeholder: "①当社は... ②当社は... ③当社は..." },
  { key: "securityCloudSystemName", column: "AL", group: "見積情報【セキュリティクラウド】", label: "システム名", role: "vendor", type: "text", placeholder: "セキュリティクラウドAI_サブスクプラン" },
  { key: "securityCloudSystemNo", column: "AM", group: "見積情報【セキュリティクラウド】", label: "システムNo", role: "vendor", type: "text", placeholder: "DL***********" },
  { key: "securityCloudUnitPrice", column: "AN", group: "見積情報【セキュリティクラウド】", label: "システム金額（単価）", role: "vendor", type: "number", placeholder: "2481000" },
  { key: "securityCloudQuantity", column: "AO", group: "見積情報【セキュリティクラウド】", label: "システム導入数量（個）", role: "vendor", type: "number", placeholder: "1" },
  { key: "securityCloudYears", column: "AP", group: "見積情報【セキュリティクラウド】", label: "システム期間（年）", role: "vendor", type: "number", placeholder: "2" },
  { key: "securityCloudSubtotal", column: "AQ", group: "見積情報【セキュリティクラウド】", label: "小計金額（税抜）", role: "vendor", type: "number", placeholder: "4962000" },
  { key: "mimamoriSystemName", column: "AR", group: "見積情報【見守り隊】", label: "システム名", role: "vendor", type: "text", placeholder: "PCセキュリティみまもりパック" },
  { key: "mimamoriSystemNo", column: "AS", group: "見積情報【見守り隊】", label: "システムNo", role: "vendor", type: "text", placeholder: "DL***********" },
  { key: "mimamoriUnitPrice", column: "AT", group: "見積情報【見守り隊】", label: "システム金額（単価）", role: "vendor", type: "number", placeholder: "9000" },
  { key: "mimamoriQuantity", column: "AU", group: "見積情報【見守り隊】", label: "システム導入数量（個）", role: "vendor", type: "number", placeholder: "1" },
  { key: "mimamoriYears", column: "AV", group: "見積情報【見守り隊】", label: "システム期間（年）", role: "vendor", type: "number", placeholder: "1" },
  { key: "mimamoriSubtotal", column: "AW", group: "見積情報【見守り隊】", label: "小計金額（税抜）", role: "vendor", type: "number", placeholder: "9000" },
  { key: "totalTaxExcluded", column: "AX", group: "見積情報", label: "合計金額（税抜）", role: "vendor", type: "number", placeholder: "4971000" },
  { key: "taxAmount", column: "AY", group: "見積情報", label: "消費税", role: "vendor", type: "number", placeholder: "546810" },
  { key: "totalTaxIncluded", column: "AZ", group: "見積情報", label: "合計金額（税込）", role: "vendor", type: "number", placeholder: "5468100" },
  { key: "minimumWage", column: "BA", group: "賃金情報", label: "事業場内最低賃金", role: "vendor", type: "number", placeholder: "1226" },
  { key: "deemedEmployeeCount", column: "BB", group: "賃金情報", label: "従業員とみなした人数", role: "vendor", type: "number", placeholder: "3" },
  { key: "totalPayroll", column: "BC", group: "賃金情報", label: "給与支払い総額", role: "vendor", type: "number", placeholder: "10000000" },
  { key: "planValueYear1", column: "BD", group: "賃金情報", label: "計画数値（1年度目）", role: "vendor", type: "number", placeholder: "10300000" },
  { key: "planValueYear2", column: "BE", group: "賃金情報", label: "計画数値（2年度目）", role: "vendor", type: "number", placeholder: "10609000" },
  { key: "planValueYear3", column: "BF", group: "賃金情報", label: "計画数値（3年度目）", role: "vendor", type: "number", placeholder: "10927300" },
  { key: "minimumWagePoint1", column: "BG", group: "加点", label: "最低賃金加点①（はいorいいえ）", role: "vendor", type: "select", options: yesNoOptions, placeholder: "はい" },
  { key: "minimumWagePoint1File", column: "BH", group: "加点", label: "最低賃金加点①（資料）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "minimumWagePoint2", column: "BI", group: "加点", label: "最低賃金加点②（はいorいいえ）", role: "vendor", type: "select", options: yesNoOptions, placeholder: "はい" },
  { key: "minimumWagePoint2File", column: "BJ", group: "加点", label: "最低賃金加点②（資料）", role: "vendor", type: "file", placeholder: "保管用ドライブURL" },
  { key: "staffApplicantName", column: "BL", group: "BPO側", label: "申請担当者名", role: "staff", type: "text" },
  { key: "industryCode", column: "BM", group: "BPO側", label: "業種コード", role: "staff", type: "text" },
  { key: "officeCount", column: "BN", group: "BPO側", label: "店舗・事業所数", role: "staff", type: "number" },
  { key: "regularEmployeeCount", column: "BO", group: "BPO側", label: "雇用：正社員数", role: "staff", type: "number" },
  { key: "contractEmployeeCount", column: "BP", group: "BPO側", label: "雇用：契約社員数", role: "staff", type: "number" },
  { key: "partTimeEmployeeCount", column: "BQ", group: "BPO側", label: "雇用：パート・アルバイト数", role: "staff", type: "number" },
  { key: "temporaryEmployeeCount", column: "BR", group: "BPO側", label: "雇用：派遣社員数", role: "staff", type: "number" },
  { key: "otherEmployeeCount", column: "BS", group: "BPO側", label: "雇用：その他", role: "staff", type: "number" },
  { key: "staffBusinessDescription", column: "BT", group: "BPO側", label: "事業内容", role: "staff", type: "textarea" },
  { key: "staffGbizEmail", column: "BU", group: "BPO側", label: "gBizIDメールアドレス", role: "staff", type: "text" },
  { key: "staffSelfDeclarationId", column: "BV", group: "BPO側", label: "自己宣言ID", role: "staff", type: "text" },
  { key: "grantApplicationNo", column: "BW", group: "BPO側", label: "交付申請番号", role: "staff", type: "text" },
  { key: "staffWageIncreaseAvailability", column: "BX", group: "BPO側", label: "賃上げ可否", role: "staff", type: "text" },
  { key: "staffMinimumWagePoint1", column: "BY", group: "BPO側", label: "最低賃金加点①", role: "staff", type: "text" },
  { key: "staffMinimumWagePoint2", column: "BZ", group: "BPO側", label: "最低賃金加点②", role: "staff", type: "text" },
  { key: "invoicePointDesired", column: "CA", group: "BPO側", label: "インボイス登録加点希望", role: "staff", type: "text" },
  { key: "staffRepeatType", column: "CB", group: "BPO側", label: "おかわり判定", role: "staff", type: "text" },
  { key: "pastIntroducedProductName", column: "CC", group: "BPO側", label: "過去導入商品名", role: "staff", type: "text" },
  { key: "staffGrowthMatching", column: "CD", group: "BPO側", label: "成長加速マッチング", role: "staff", type: "text" },
  { key: "completionDate", column: "CE", group: "BPO側", label: "完了日", role: "staff", type: "date" },
  { key: "nextAction", column: "CF", group: "BPO側", label: "次回", role: "staff", type: "textarea" },
  { key: "takeawayQuestions", column: "CG", group: "BPO側", label: "お持ち帰りご質問・連絡事項等", role: "staff", type: "textarea" },
];

export const VENDOR_BPO_FIELDS = APPLICATION_BPO_FIELDS.filter((field) => field.role === "vendor");
export const STAFF_BPO_FIELDS = APPLICATION_BPO_FIELDS.filter((field) => field.role === "staff");
export const APPLICATION_BPO_FILE_FIELDS = APPLICATION_BPO_FIELDS.filter((field) => field.type === "file");

export function groupApplicationBpoFields(fields: ApplicationBpoField[]) {
  const groups: { name: string; fields: ApplicationBpoField[] }[] = [];
  for (const field of fields) {
    const current = groups[groups.length - 1];
    if (current?.name === field.group) {
      current.fields.push(field);
    } else {
      groups.push({ name: field.group, fields: [field] });
    }
  }
  return groups;
}
