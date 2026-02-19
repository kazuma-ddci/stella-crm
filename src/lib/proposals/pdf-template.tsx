import React from "react";
import { Document, Page, View, Text, Font, StyleSheet } from "@react-pdf/renderer";
import path from "path";
import type { ProposalContent } from "./simulation";

// フォント登録
Font.register({
  family: "NotoSansJP",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Bold.ttf"), fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    padding: 40,
    backgroundColor: "#ffffff",
  },
  // 表紙
  coverPage: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    padding: 0,
    backgroundColor: "#1e40af",
  },
  coverContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  coverSubTitle: {
    fontSize: 12,
    color: "#93c5fd",
    marginBottom: 20,
    letterSpacing: 4,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
  },
  coverTitle2: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 40,
  },
  coverDivider: {
    width: 200,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 30,
  },
  coverCompany: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  coverDate: {
    fontSize: 9,
    color: "rgba(255,255,255,0.7)",
    marginTop: 30,
  },

  // セクション
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: "#dc2626",
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    lineHeight: 20,
    marginRight: 8,
  },
  sectionBadgeGreen: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: "#16a34a",
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    lineHeight: 20,
    marginRight: 8,
  },
  sectionBadgeBlue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    width: 20,
    height: 20,
    textAlign: "center",
    lineHeight: 20,
    marginRight: 8,
  },

  // グリッド
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  col2: {
    width: "50%",
    paddingHorizontal: 4,
  },

  // カード
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  cardValueRed: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#dc2626",
  },
  cardRed: {
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },

  // シナリオ
  scenarioBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 12,
    width: "48%",
  },
  scenarioBoxHighlight: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    padding: 12,
    width: "48%",
  },
  scenarioBoxBlueHighlight: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    padding: 12,
    width: "48%",
  },
  scenarioTitle: {
    fontSize: 8,
    color: "#6b7280",
    fontWeight: "bold",
    marginBottom: 8,
  },
  scenarioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  scenarioLabel: {
    fontSize: 8,
    color: "#6b7280",
  },
  scenarioValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  scenarioValueGreen: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#16a34a",
  },
  scenarioValueBlue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#2563eb",
  },

  // フッター
  breakdownText: {
    fontSize: 7,
    color: "#9ca3af",
    marginTop: 8,
  },
});

function formatCurrency(value: number): string {
  return value.toLocaleString("ja-JP") + "円";
}

function formatCurrencyMan(value: number): string {
  return Math.round(value / 10000).toLocaleString("ja-JP") + "万円";
}

type Props = {
  content: ProposalContent;
};

export function ProposalPdfTemplate({ content }: Props) {
  const { input, result } = content;
  const { before, scenario10, scenario20 } = result;

  return (
    <Document>
      {/* 表紙 */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          <Text style={styles.coverSubTitle}>採用ブースト</Text>
          <Text style={styles.coverTitle}>採用コスト削減</Text>
          <Text style={styles.coverTitle2}>シミュレーション提案書</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverCompany}>{input.companyName} 様</Text>
          <Text style={styles.coverDate}>
            {new Date(content.generatedAt).toLocaleDateString("ja-JP")}
          </Text>
        </View>
      </Page>

      {/* Before - 現状分析 */}
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={styles.sectionBadge}><Text>B</Text></View>
          <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1f2937" }}>現状の採用コスト分析</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>年間採用コスト</Text>
              <Text style={styles.cardValue}>{formatCurrencyMan(before.annualCost)}</Text>
            </View>
          </View>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>年間採用人数</Text>
              <Text style={styles.cardValue}>{before.annualHires}名</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col2}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>1名あたり採用単価</Text>
              <Text style={styles.cardValueRed}>{formatCurrency(before.costPerHire)}</Text>
            </View>
          </View>
          <View style={styles.col2}>
            <View style={styles.cardRed}>
              <Text style={styles.cardLabel}>目標{input.targetHires}名採用時の総コスト</Text>
              <Text style={styles.cardValueRed}>{formatCurrencyMan(before.totalCostForTarget)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.breakdownText}>
          内訳: 人材紹介 {formatCurrencyMan(input.recruitmentAgencyCost)} / 求人広告 {formatCurrencyMan(input.jobAdCost)} / リファラル {formatCurrencyMan(input.referralCost)} / その他 {formatCurrencyMan(input.otherCost)}
        </Text>

        {/* After - 成果報酬型 */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={styles.sectionBadgeGreen}><Text>A</Text></View>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1f2937" }}>採用ブースト導入後（成果報酬型）</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={styles.scenarioBox}>
              <Text style={styles.scenarioTitle}>応募→採用率 10%</Text>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>予想期間</Text>
                <Text style={styles.scenarioValue}>{scenario10.months}ヶ月</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>総コスト</Text>
                <Text style={styles.scenarioValueGreen}>{formatCurrencyMan(scenario10.successFeeCost)}</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>削減率</Text>
                <Text style={styles.scenarioValueGreen}>
                  {scenario10.reductionSuccess > 0 ? "▼" : "▲"}{Math.abs(scenario10.reductionSuccess)}%
                </Text>
              </View>
            </View>

            <View style={styles.scenarioBoxHighlight}>
              <Text style={styles.scenarioTitle}>応募→採用率 20%</Text>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>予想期間</Text>
                <Text style={styles.scenarioValue}>{scenario20.months}ヶ月</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>総コスト</Text>
                <Text style={styles.scenarioValueGreen}>{formatCurrencyMan(scenario20.successFeeCost)}</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>削減率</Text>
                <Text style={styles.scenarioValueGreen}>
                  {scenario20.reductionSuccess > 0 ? "▼" : "▲"}{Math.abs(scenario20.reductionSuccess)}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* After - 月額固定型 */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={styles.sectionBadgeBlue}><Text>A</Text></View>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1f2937" }}>採用ブースト導入後（月額固定型）</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={styles.scenarioBox}>
              <Text style={styles.scenarioTitle}>応募→採用率 10%</Text>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>予想期間</Text>
                <Text style={styles.scenarioValue}>{scenario10.months}ヶ月</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>総コスト</Text>
                <Text style={styles.scenarioValueBlue}>{formatCurrencyMan(scenario10.monthlyFeeCost)}</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>削減率</Text>
                <Text style={styles.scenarioValueBlue}>
                  {scenario10.reductionMonthly > 0 ? "▼" : "▲"}{Math.abs(scenario10.reductionMonthly)}%
                </Text>
              </View>
            </View>

            <View style={styles.scenarioBoxBlueHighlight}>
              <Text style={styles.scenarioTitle}>応募→採用率 20%</Text>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>予想期間</Text>
                <Text style={styles.scenarioValue}>{scenario20.months}ヶ月</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>総コスト</Text>
                <Text style={styles.scenarioValueBlue}>{formatCurrencyMan(scenario20.monthlyFeeCost)}</Text>
              </View>
              <View style={styles.scenarioRow}>
                <Text style={styles.scenarioLabel}>削減率</Text>
                <Text style={styles.scenarioValueBlue}>
                  {scenario20.reductionMonthly > 0 ? "▼" : "▲"}{Math.abs(scenario20.reductionMonthly)}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
