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

export type TrainingReportPdfData = {
  applicantName: string;
  applicantAddress: string;
  applicantPhone: string;
  formAnswerDate: Date;
  advisorCompanyName: string;
  advisorPersonName: string;
};

const SUPPORT_TARGET_ITEMS: Array<{ category: string; content: string }> = [
  { category: "知識・理解", content: "DXに関する基礎知識を学び理解することが出来た" },
  { category: "知識・理解", content: "自社の業務プロセスや課題を整理できた" },
  { category: "知識・理解", content: "DX推進の重要性を理解した" },
  { category: "実施・行動", content: "認定アドバイザーにサポートを受けた" },
  { category: "実施・行動", content: "SWOT分析を実施し、課題と強みを把握した" },
  { category: "実施・行動", content: "研修を受講し、自社のDX推進に向けた理解を深めた" },
  { category: "目標", content: "今後もデジタル化を推進する意思を持った" },
  { category: "目標", content: "デジタル促進の重要性を他者に発信しようと思った" },
];

const ADVISOR_ITEMS: string[] = [
  "企業はDXに関する基準を満たしている",
  "企業は研修時間・理解を十分に満たしている",
  "企業の研修を終了とする",
];

function toReiwa(date: Date): { year: number; month: number; day: number } {
  return { year: date.getFullYear() - 2018, month: date.getMonth() + 1, day: date.getDate() };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSerifJP",
    fontSize: 10,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 40,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 24,
    fontSize: 10,
  },
  dateItem: {
    marginLeft: 12,
  },
  targetBlock: {
    marginBottom: 14,
  },
  targetTitle: {
    fontSize: 10,
    marginBottom: 4,
  },
  targetLine: {
    flexDirection: "row",
    fontSize: 10,
    marginBottom: 2,
  },
  targetLabel: {
    width: 56,
    paddingLeft: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    backgroundColor: "#fafafa",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  cellNo: {
    width: 32,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "center",
    fontSize: 9,
  },
  cellCategory: {
    width: 70,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "center",
    fontSize: 9,
  },
  cellContent: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 9,
    textAlign: "center",
  },
  cellCheck: {
    width: 64,
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "bold",
  },
  cellCheckHeader: {
    width: 64,
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "center",
    fontSize: 9,
  },
  remarks: {
    fontSize: 9,
    marginTop: 2,
    marginBottom: 8,
  },
  confirmedText: {
    fontSize: 10,
    textAlign: "right",
    marginTop: 2,
    marginBottom: 10,
  },
  certifyBlock: {
    marginTop: 14,
    marginBottom: 10,
    alignItems: "center",
  },
  certifyText: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 2,
  },
  certifyCheckbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 6,
    padding: 0,
  },
  certifyCheckmark: {
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 1.1,
    marginTop: -1,
  },
  certifyNote: {
    fontSize: 9,
    textAlign: "center",
    color: "#333",
  },
  advisorBlock: {
    marginTop: 18,
    alignItems: "flex-end",
  },
  advisorLabel: {
    fontSize: 10,
    marginBottom: 6,
  },
  advisorLine: {
    fontSize: 10,
    marginBottom: 2,
  },
});

function CheckMark() {
  return <Text>✓</Text>;
}

export function TrainingReportPdf({ data }: { data: TrainingReportPdfData }) {
  const { year, month, day } = toReiwa(data.formAnswerDate);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.dateRow}>
          <Text>令和</Text>
          <Text style={styles.dateItem}>{year} 年</Text>
          <Text style={styles.dateItem}>{month} 月</Text>
          <Text style={styles.dateItem}>{day} 日</Text>
        </View>

        <View style={styles.targetBlock}>
          <Text style={styles.targetTitle}>支援対象者</Text>
          <View style={styles.targetLine}>
            <Text style={styles.targetLabel}>氏名:</Text>
            <Text>{data.applicantName}</Text>
          </View>
          <View style={styles.targetLine}>
            <Text style={styles.targetLabel}>住所:</Text>
            <Text>{data.applicantAddress}</Text>
          </View>
          <View style={styles.targetLine}>
            <Text style={styles.targetLabel}>電話番号:</Text>
            <Text>{data.applicantPhone}</Text>
          </View>
        </View>

        <Text style={styles.title}>研修終了報告書</Text>

        <Text style={styles.sectionHeader}>支援対象者記載</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.cellNo}>NO</Text>
            <Text style={styles.cellCategory}>分 類</Text>
            <Text style={styles.cellContent}>内容</Text>
            <Text style={styles.cellCheckHeader}>チェック</Text>
          </View>
          {SUPPORT_TARGET_ITEMS.map((item, idx) => {
            const isLast = idx === SUPPORT_TARGET_ITEMS.length - 1;
            return (
              <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                <Text style={styles.cellNo}>{idx + 1}</Text>
                <Text style={styles.cellCategory}>{item.category}</Text>
                <Text style={styles.cellContent}>{item.content}</Text>
                <Text style={styles.cellCheck}>
                  <CheckMark />
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.remarks}>（備考）</Text>

        <Text style={styles.sectionHeader}>認定アドバイザー記載</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.cellNo}>NO</Text>
            <Text style={styles.cellCategory}>分 類</Text>
            <Text style={styles.cellContent}>内容</Text>
            <Text style={styles.cellCheckHeader}>チェック</Text>
          </View>
          {ADVISOR_ITEMS.map((content, idx) => {
            const isLast = idx === ADVISOR_ITEMS.length - 1;
            return (
              <View key={idx} style={isLast ? styles.tableRowLast : styles.tableRow}>
                <Text style={styles.cellNo}>{idx + 1}</Text>
                <Text style={styles.cellCategory}> </Text>
                <Text style={styles.cellContent}>{content}</Text>
                <Text style={styles.cellCheck}>
                  <CheckMark />
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.confirmedText}>以上確認しました。</Text>

        <View style={styles.certifyBlock}>
          <Text style={styles.certifyText}>
            令和7年度 中小企業デジタル促進支援制度により DXにおける理解を深め実施を行い、
          </Text>
          <Text style={styles.certifyText}>
            支援対象企業が本プログラムを修了したことを証明する。
          </Text>
          <View style={styles.certifyCheckbox}>
            <Text style={styles.certifyCheckmark}>✓</Text>
          </View>
          <Text style={styles.certifyNote}>※認定アドバイザーよりの記載とする</Text>
        </View>

        <View style={styles.advisorBlock}>
          <Text style={styles.advisorLabel}>認定アドバイザー</Text>
          <Text style={styles.advisorLine}>企業名: {data.advisorCompanyName}</Text>
          <Text style={styles.advisorLine}>担当者名: {data.advisorPersonName}</Text>
        </View>
      </Page>
    </Document>
  );
}
