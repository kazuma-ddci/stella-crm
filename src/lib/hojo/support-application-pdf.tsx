import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import path from "path";

Font.register({
  family: "NotoSerifJP",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/NotoSerifJP-Regular.otf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/NotoSerifJP-Bold.otf"),
      fontWeight: "bold",
    },
  ],
});

export type SupportApplicationPdfData = {
  applicationDate: Date | null;
  companyName: string;
  representativeName: string;
  officeAddress: string;
  phone: string;
  email: string;
  homepageUrl: string;
  remarks: string;
  subsidyAmount: number | null;
  bankType: "ゆうちょ銀行" | "他の金融機関" | null;
  yucho: {
    symbol: string;
    passbookNumber: string;
    accountHolderKana: string;
    accountHolder: string;
  };
  other: {
    bankName: string;
    bankCode: string;
    branchName: string;
    branchCode: string;
    accountType: "普通（総合）" | "当座" | null;
    accountNumber: string;
    accountHolderKana: string;
    accountHolder: string;
  };
};

function formatSubsidyAmount(amount: number | null): string {
  if (amount == null) return "";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateParts(date: Date | null): { year: string; month: string; day: string } {
  if (!date) return { year: "", month: "", day: "" };
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1),
    day: String(date.getDate()),
  };
}

function toCells(value: string, length: number, rightAlign = false): string[] {
  const chars = (value ?? "").split("");
  const cells = new Array<string>(length).fill("");
  if (rightAlign) {
    const start = Math.max(0, length - chars.length);
    for (let i = 0; i < chars.length && start + i < length; i++) {
      cells[start + i] = chars[i];
    }
  } else {
    for (let i = 0; i < chars.length && i < length; i++) {
      cells[i] = chars[i];
    }
  }
  return cells;
}

const BORDER = "#000";
const CELL_W = 25;

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSerifJP",
    fontSize: 10,
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  subHeader: {
    fontSize: 10,
    marginBottom: 2,
  },
  agreeText: {
    fontSize: 8,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    marginTop: 10,
    marginBottom: 3,
  },
  note: {
    fontSize: 8,
    color: "#ff2600",
    marginTop: 2,
    marginBottom: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowLast: {
    flexDirection: "row",
  },

  // ===== 申請日行 =====
  dateLabelCell: {
    width: 110,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 10,
  },
  dateValueCell: {
    width: 200,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 10,
  },

  // ===== 申請者情報 =====
  infoLabelCell: {
    width: 100,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 10,
  },
  infoValueCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 10,
  },
  remarksLabelInner: {
    paddingVertical: 6,
    fontSize: 10,
    textAlign: "center",
  },

  // ===== 支援枠 =====
  frameLabelCell: {
    width: 100,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 10,
  },
  frameValueCell: {
    width: 280,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 10,
  },

  // ===== 口座情報 共通 =====
  accountSectionHeader: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    fontSize: 9,
  },
  accountFieldRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  accountFieldRowLast: {
    flexDirection: "row",
  },
  accountFieldLabel: {
    // 75 = 記号マス3個分(25*3)、ゆうちょ記号マス3/4の間の縦線と揃う
    width: CELL_W * 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontSize: 10,
  },
  accountFieldValue: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 10,
  },

  // ===== ゆうちょ: 記号/通帳番号 ラベル行 =====
  yuchoLabelRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  yuchoSymbolLabel: {
    width: CELL_W * 5, // 125 — 記号マス5個と同じ幅
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontSize: 9,
  },
  yuchoPassbookLabel: {
    width: CELL_W * 8, // 200 — 通帳番号マス8個と同じ幅
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontSize: 9,
  },

  // ===== ゆうちょ: マス行 =====
  yuchoCellRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  // ===== 金融機関: 種別＋銀行名行 =====
  bankBrandRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    minHeight: 50,
  },
  bankBrandLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bankBrandRight: {
    // 225 = 515 - 基準線X(290pt)
    width: 225,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bankNameText: {
    flex: 1,
    fontSize: 13,
    textAlign: "center",
  },
  bankCategoryList: {
    flexDirection: "column",
    width: 70,
  },
  bankCategoryItem: {
    fontSize: 8,
    paddingVertical: 0.5,
  },
  branchCategoryList: {
    flexDirection: "column",
    width: 50,
  },

  // ===== 金融機関: コード行 =====
  bankCodeRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  codeLabelCell: {
    // 189 = 基準線X(290pt)で完全一致する調整値
    width: 189,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 10,
  },
  branchCodeLabelCell: {
    // 151 = 行合計 515pt を維持
    width: 151,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 10,
  },

  // ===== 金融機関: 口座種別 + 口座番号行 =====
  accountTypeRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  accountTypeArea: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    fontSize: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  accountTypeOption: {
    marginRight: 24,
    fontSize: 10,
  },
  accountNumberLabel: {
    // 50 = 基準線X(290)〜口座番号マス左端(340)、2行表示でコンパクト化
    width: 50,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    textAlign: "center",
    fontSize: 9,
    lineHeight: 1.2,
  },

});

function makeCellStyle(cellWidth: number, noBorder: boolean) {
  // React PDF は box-sizing: border-box がデフォルト（width に border を含む）。
  // そのため cellWidth をそのまま指定すれば実占有幅も cellWidth になり、
  // ラベル幅（cellWidth×マス数）と完全一致する。
  return {
    width: cellWidth,
    paddingVertical: 5,
    textAlign: "center" as const,
    fontSize: 10,
    ...(noBorder
      ? {}
      : { borderRightWidth: 1, borderRightColor: BORDER }),
  };
}

function CheckMark({ checked }: { checked: boolean }) {
  return <Text>{checked ? "(✓)" : "( )"}</Text>;
}

function DigitCells({
  values,
  cellWidth = CELL_W,
  allBorder = false,
}: {
  values: string[];
  cellWidth?: number;
  /** true にすると最後のマスにも borderRight を付ける */
  allBorder?: boolean;
}) {
  return (
    <>
      {values.map((v, i) => {
        const isLast = i === values.length - 1;
        const noBorder = isLast && !allBorder;
        return (
          <Text key={i} style={makeCellStyle(cellWidth, noBorder)}>
            {v || " "}
          </Text>
        );
      })}
    </>
  );
}

export function SupportApplicationPdf({ data }: { data: SupportApplicationPdfData }) {
  const { year, month, day } = formatDateParts(data.applicationDate);
  const subsidyText = formatSubsidyAmount(data.subsidyAmount);
  const isYucho = data.bankType === "ゆうちょ銀行";
  const isOther = data.bankType === "他の金融機関";

  const yuchoSymbolCells = toCells(isYucho ? data.yucho.symbol : "", 5);
  const yuchoPassbookCells = toCells(isYucho ? data.yucho.passbookNumber : "", 8, true);
  const bankCodeCells = toCells(isOther ? data.other.bankCode : "", 4);
  const branchCodeCells = toCells(isOther ? data.other.branchCode : "", 3);
  const accountNumberCells = toCells(isOther ? data.other.accountNumber : "", 7, true);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>【 支援制度申請書 】</Text>
        <Text style={styles.subHeader}>中小企業振興支援協会　御中</Text>
        <Text style={styles.agreeText}>
          中小企業振興支援協会にる本制度規約に同意するものとし、以下の内容にて申請いたします。
        </Text>

        {/* お申し込み年月日 */}
        <View style={[styles.table, { alignSelf: "flex-start" }]}>
          <View style={styles.rowLast}>
            <Text style={styles.dateLabelCell}>お申し込み年月日</Text>
            <Text style={styles.dateValueCell}>
              {year ? `${year} 年　${month} 月　${day} 日` : "　　　年　　月　　日"}
            </Text>
          </View>
        </View>

        {/* 支援制度申請者情報 */}
        <Text style={styles.sectionLabel}>▼支援制度申請者情報</Text>
        <View style={[styles.table, { width: "100%" }]}>
          <View style={styles.row}>
            <Text style={styles.infoLabelCell}>会社名</Text>
            <Text style={styles.infoValueCell}>{data.companyName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.infoLabelCell}>代表者名</Text>
            <Text style={styles.infoValueCell}>{data.representativeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.infoLabelCell}>所在地(本店)</Text>
            <Text style={styles.infoValueCell}>{data.officeAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.infoLabelCell}>電話番号</Text>
            <Text style={styles.infoValueCell}>{data.phone}</Text>
          </View>
          {/* Email + HP URL 2行 + 備考（右側rowspan=2相当） */}
          <View style={styles.rowLast}>
            <View style={{ flex: 1, flexDirection: "column" }}>
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                }}
              >
                <Text style={styles.infoLabelCell}>Email アドレス</Text>
                <Text style={styles.infoValueCell}>{data.email}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={styles.infoLabelCell}>ホームページURL</Text>
                <Text style={styles.infoValueCell}>{data.homepageUrl}</Text>
              </View>
            </View>
            <View
              style={{
                width: 60,
                borderLeftWidth: 1,
                borderLeftColor: BORDER,
                borderRightWidth: 1,
                borderRightColor: BORDER,
                justifyContent: "center",
              }}
            >
              <Text style={styles.remarksLabelInner}>備考</Text>
            </View>
            <View style={{ width: 120, justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 10 }}>{data.remarks}</Text>
            </View>
          </View>
        </View>

        {/* 支援制度申請枠 */}
        <Text style={styles.sectionLabel}>▼支援制度申請枠</Text>
        <View style={[styles.table, { alignSelf: "flex-start" }]}>
          <View style={styles.rowLast}>
            <Text style={styles.frameLabelCell}>支援枠</Text>
            <Text style={styles.frameValueCell}>{subsidyText}</Text>
          </View>
        </View>
        <Text style={styles.note}>※認定アドバイザー算出のもとご記入ください</Text>

        {/* 口座情報 — 全体 1 つの統合テーブル（隙間なし） */}
        <Text style={styles.sectionLabel}>▼口座情報</Text>
        <View style={[styles.table, { width: "100%" }]}>
          {/* ---- ゆうちょ銀行・郵便局 ---- */}
          <Text style={styles.accountSectionHeader}>ゆうちょ銀行・郵便局</Text>

          {/* 記号・通帳番号 エリア（ラベル行＋マス行を左側にまとめ、右端余白は2段結合） */}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            {/* 左側: ラベル行 + マス行の2段 */}
            <View style={{ flexDirection: "column" }}>
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: BORDER,
                }}
              >
                <Text style={styles.yuchoSymbolLabel}>記号</Text>
                <Text style={styles.yuchoPassbookLabel}>
                  通帳番号(右詰めでご記入ください)
                </Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                <DigitCells values={yuchoSymbolCells} allBorder />
                <DigitCells values={yuchoPassbookCells} allBorder />
              </View>
            </View>
            {/* 右端: ラベル行とマス行にまたがる1つの結合セル（中の横線なし） */}
            <View style={{ flex: 1 }} />
          </View>

          {/* フリガナ */}
          <View style={styles.accountFieldRow}>
            <Text style={styles.accountFieldLabel}>フリガナ</Text>
            <Text style={styles.accountFieldValue}>
              {isYucho ? data.yucho.accountHolderKana : ""}
            </Text>
          </View>

          {/* 口座名義 */}
          <View style={styles.accountFieldRow}>
            <Text style={styles.accountFieldLabel}>口座名義</Text>
            <Text style={styles.accountFieldValue}>
              {isYucho ? data.yucho.accountHolder : ""}
            </Text>
          </View>

          {/* ---- 金融機関 ---- */}
          <Text style={styles.accountSectionHeader}>金融機関</Text>

          {/* 銀行名 + 種別縦並び / 支店名 + 本支店縦並び */}
          <View style={styles.bankBrandRow}>
            <View style={styles.bankBrandLeft}>
              <Text style={styles.bankNameText}>
                {isOther ? data.other.bankName : ""}
              </Text>
              <View style={styles.bankCategoryList}>
                <Text style={styles.bankCategoryItem}>銀行</Text>
                <Text style={styles.bankCategoryItem}>信用組合</Text>
                <Text style={styles.bankCategoryItem}>信用金庫</Text>
                <Text style={styles.bankCategoryItem}>農協共同組合</Text>
              </View>
            </View>
            <View style={styles.bankBrandRight}>
              <Text style={styles.bankNameText}>
                {isOther ? data.other.branchName : ""}
              </Text>
              <View style={styles.branchCategoryList}>
                <Text style={styles.bankCategoryItem}>本店</Text>
                <Text style={styles.bankCategoryItem}>支店</Text>
                <Text style={styles.bankCategoryItem}>出張所</Text>
              </View>
            </View>
          </View>

          {/* 金融機関コード(4マス) / 支店コード(3マス) — 基準線 X=290pt
              - 金融機関コードラベル(190) + マス4個(100) で基準線X
              - 支店コードラベル(150) + マス3個(75) */}
          <View style={styles.bankCodeRow}>
            <Text style={styles.codeLabelCell}>金融機関コード</Text>
            <View style={{ flexDirection: "row" }}>
              {/* allBorder で4マス目右端にも縦線（基準線Xの描画） */}
              <DigitCells values={bankCodeCells} allBorder />
            </View>
            <Text style={styles.branchCodeLabelCell}>支店コード</Text>
            <View style={{ flexDirection: "row" }}>
              <DigitCells values={branchCodeCells} />
            </View>
          </View>

          {/* 口座種別 + 口座番号(7マス) */}
          <View style={styles.accountTypeRow}>
            <View style={styles.accountTypeArea}>
              <Text style={styles.accountTypeOption}>
                <CheckMark checked={isOther && data.other.accountType === "普通（総合）"} /> 普通（総合）
              </Text>
              <Text style={styles.accountTypeOption}>
                <CheckMark checked={isOther && data.other.accountType === "当座"} /> 当座
              </Text>
            </View>
            <Text style={styles.accountNumberLabel}>口座番号{"\n"}(右詰め)</Text>
            <View style={{ flexDirection: "row" }}>
              <DigitCells values={accountNumberCells} />
            </View>
          </View>

          {/* フリガナ */}
          <View style={styles.accountFieldRow}>
            <Text style={styles.accountFieldLabel}>フリガナ</Text>
            <Text style={styles.accountFieldValue}>
              {isOther ? data.other.accountHolderKana : ""}
            </Text>
          </View>

          {/* 口座名義 */}
          <View style={styles.accountFieldRowLast}>
            <Text style={styles.accountFieldLabel}>口座名義</Text>
            <Text style={styles.accountFieldValue}>
              {isOther ? data.other.accountHolder : ""}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
