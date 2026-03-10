import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
} from "@react-pdf/renderer";
import path from "path";

// フォント登録
Font.register({
  family: "NotoSansJP",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/NotoSansJP-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

// ============================================
// 型定義
// ============================================

export type InvoicePdfData = {
  operatingCompany: {
    companyName: string;
    registrationNumber: string | null;
    postalCode: string | null;
    address: string | null;
    address2: string | null;
    representativeName: string | null;
    phone: string | null;
    logoPath: string | null;
    email: string | null;
  };
  counterpartyName: string;
  honorific?: string;
  remarks?: string | null;
  memoLines?: { id: number; description: string; sortOrder: number }[];
  lineOrder?: string[] | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paymentDueDate: string | null;
  lineItems: {
    id: number;
    description: string;
    period: string;
    amount: number;
    taxRate: number;
  }[];
  taxSummary: Record<string, { subtotal: number; tax: number }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  bankAccount: {
    bankName: string;
    branchName: string;
    branchCode: string;
    accountNumber: string;
    accountHolderName: string;
  } | null;
};

// ============================================
// 定数
// ============================================

const MIN_TABLE_ROWS = 8;
const LOGO_HEIGHT = 52;
const WAVE_PATH = path.join(process.cwd(), "public/images/invoice-wave.png");
const STP_LOGO_PATH = path.join(process.cwd(), "public/images/stp-logo.png");

// ============================================
// スタイル
// ============================================

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    backgroundColor: "#ffffff",
    color: "#1f2937",
    position: "relative",
  },
  waveContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 70,
  },
  content: {
    padding: 48,
    paddingTop: 86,
  },
  // 上部メタ情報
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 6,
    height: LOGO_HEIGHT,
  },
  metaLeft: {
    flexDirection: "column",
    justifyContent: "center",
    height: LOGO_HEIGHT,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLineFirst: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 8,
    color: "#6b7280",
  },
  metaValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  logoContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  logo: {
    width: 160,
    height: LOGO_HEIGHT,
    objectFit: "contain",
  },
  // 区切り線
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginBottom: 16,
  },
  // ヘッダー
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "stretch",
    marginBottom: 28,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 20,
    flexDirection: "column",
  },
  headerRight: {
    width: 220,
    alignItems: "flex-end",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    paddingBottom: 4,
    marginBottom: 6,
  },
  honorific: {
    fontSize: 13,
    marginLeft: 4,
  },
  subText: {
    fontSize: 9,
    color: "#4b5563",
    marginBottom: 16,
  },
  // 合計金額ボックス（2カラム・枠線付き）
  totalBox: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginTop: "auto",
  },
  totalLabelBox: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1f2937",
  },
  totalValueBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111827",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 6,
    marginBottom: 8,
    textAlign: "right",
  },
  issuerSection: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  issuerDetail: {
    fontSize: 8,
    color: "#4b5563",
    marginBottom: 1,
    textAlign: "right",
  },
  issuerName: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "right",
  },
  registrationNumber: {
    fontSize: 8.4,
    color: "#6b7280",
    marginTop: 5,
    textAlign: "right",
  },
  // 明細テーブル
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#9ca3af",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 7,
    paddingHorizontal: 8,
    minHeight: 26,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 7,
    paddingHorizontal: 8,
    backgroundColor: "#f9fafb",
    minHeight: 26,
  },
  tableCell: {
    fontSize: 9,
  },
  colDescription: { width: "35%" },
  colPeriod: { width: "32%" },
  colTaxRate: { width: "8%", textAlign: "right" as const },
  colAmount: { width: "25%", textAlign: "right" as const },
  // 小計・振込先の2カラムラッパー
  summaryBankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  // 小計・税額セクション
  summarySection: {
    alignItems: "flex-end",
    width: 200,
  },
  summaryRow: {
    flexDirection: "row",
    width: 200,
    alignItems: "center",
    height: 28,
    paddingRight: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  summaryLabel: {
    fontSize: 9,
    color: "#4b5563",
    width: 85,
    textAlign: "right" as const,
  },
  summaryValue: {
    fontSize: 9,
    flex: 1,
    textAlign: "right" as const,
  },
  summaryTotalRow: {
    flexDirection: "row",
    width: 200,
    alignItems: "center",
    height: 32,
    paddingRight: 8,
    backgroundColor: "#f3f4f6",
    marginTop: 2,
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    width: 85,
    textAlign: "right" as const,
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
    textAlign: "right" as const,
  },
  // 振込先
  bankSection: {
    flex: 1,
    paddingTop: 26,
  },
  bankTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
  },
  bankRow: {
    marginBottom: 3,
  },
  bankText: {
    fontSize: 10,
    color: "#374151",
  },
  // 備考
  remarksSection: {
    marginTop: 12,
  },
  remarksTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 4,
  },
  remarksText: {
    fontSize: 8,
    color: "#4b5563",
  },
});

// ============================================
// ヘルパー
// ============================================

function formatCurrency(value: number): string {
  return `${value.toLocaleString("ja-JP")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${year}.${Number(month)}.${Number(day)}`;
}

// ============================================
// コンポーネント
// ============================================

type Props = {
  data: InvoicePdfData;
};

export function InvoicePdfTemplate({ data }: Props) {
  const {
    operatingCompany,
    counterpartyName,
    invoiceNumber,
    invoiceDate,
    paymentDueDate,
    lineItems,
    taxSummary,
    subtotal,
    totalAmount,
    bankAccount,
  } = data;

  const taxRates = Object.keys(taxSummary).sort(
    (a, b) => Number(a) - Number(b)
  );

  // 明細行の構築（lineOrder対応）
  const memoLines = data.memoLines ?? [];
  const order = data.lineOrder;

  type DisplayItem =
    | { type: "tx"; item: (typeof lineItems)[number] }
    | { type: "memo"; memo: { description: string } };

  let displayItems: DisplayItem[];

  if (order && order.length > 0) {
    const txMap = new Map(lineItems.map((item) => [item.id, item]));
    const usedTxIds = new Set<number>();

    displayItems = [];
    for (const key of order) {
      if (key.startsWith("memo:")) {
        const memoId = parseInt(key.split(":")[1], 10);
        const memo = memoLines.find((m) => m.id === memoId);
        displayItems.push({
          type: "memo" as const,
          memo: memo ?? { description: "" },
        });
      } else {
        const txId = parseInt(key.split(":")[1], 10);
        const item = txMap.get(txId);
        if (item && !usedTxIds.has(txId)) {
          usedTxIds.add(txId);
          displayItems.push({ type: "tx" as const, item });
        }
      }
    }
    for (const item of lineItems) {
      if (!usedTxIds.has(item.id)) {
        displayItems.push({ type: "tx" as const, item });
      }
    }
  } else {
    displayItems = lineItems.map((item) => ({ type: "tx" as const, item }));
  }

  const emptyRowsCount = Math.max(0, MIN_TABLE_ROWS - displayItems.length);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ウェーブ装飾 */}
        <Image src={WAVE_PATH} style={styles.waveContainer} />

        {/* メインコンテンツ */}
        <View style={styles.content}>
          {/* 上部: 請求書番号・発行日（左・縦並び） + ロゴ（右） */}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <View style={styles.metaLineFirst}>
                <Text style={styles.metaLabel}>請求書番号：</Text>
                <Text style={styles.metaValue}>
                  {invoiceNumber ?? "（未採番）"}
                </Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>請求発行日：</Text>
                <Text style={styles.metaValue}>
                  {formatDate(invoiceDate)}
                </Text>
              </View>
            </View>
            <View style={styles.logoContainer}>
              <Image src={STP_LOGO_PATH} style={styles.logo} />
            </View>
          </View>

          {/* 区切り線 */}
          <View style={styles.divider} />

          {/* ヘッダー: 左（宛先＋合計）・右（請求書タイトル＋発行元） */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.customerName}>
                {counterpartyName}
                <Text style={styles.honorific}>
                  {"  "}
                  {data.honorific ?? "御中"}
                </Text>
              </Text>
              <Text style={styles.subText}>
                下記のとおり、請求致します
              </Text>

              {/* 合計金額ボックス（2カラム） */}
              <View style={styles.totalBox}>
                <View style={styles.totalLabelBox}>
                  <Text style={styles.totalLabel}>合計金額</Text>
                </View>
                <View style={styles.totalValueBox}>
                  <Text style={styles.totalValue}>
                    {formatCurrency(totalAmount)}円(税込)
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              <Text style={styles.title}>請求書</Text>
              <View style={styles.issuerSection}>
                {operatingCompany.postalCode && (
                  <Text style={styles.issuerDetail}>
                    〒{operatingCompany.postalCode}
                  </Text>
                )}
                {operatingCompany.address && (
                  <Text style={styles.issuerDetail}>
                    {operatingCompany.address}
                  </Text>
                )}
                {operatingCompany.address2 && (
                  <Text style={styles.issuerDetail}>
                    {operatingCompany.address2}
                  </Text>
                )}
                {operatingCompany.email && (
                  <Text style={styles.issuerDetail}>
                    {operatingCompany.email}
                  </Text>
                )}
                <Text style={styles.issuerName}>
                  {operatingCompany.companyName}
                </Text>
                {operatingCompany.registrationNumber && (
                  <Text style={styles.registrationNumber}>
                    登録番号: {operatingCompany.registrationNumber}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* 明細テーブル */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colDescription]}>
                摘要
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colPeriod]}>
                対象期間
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colTaxRate]}>
                税率
              </Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>
                金額（税抜）
              </Text>
            </View>

            {displayItems.map((di, i) => {
              if (di.type === "memo") {
                return (
                  <View
                    key={`memo-${i}`}
                    style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  >
                    <Text style={[styles.tableCell, { width: "100%" }]}>
                      {di.memo.description}
                    </Text>
                  </View>
                );
              }
              return (
                <View
                  key={`tx-${di.item.id}`}
                  style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, styles.colDescription]}>
                    {di.item.description}
                  </Text>
                  <Text style={[styles.tableCell, styles.colPeriod]}>
                    {di.item.period}
                  </Text>
                  <Text style={[styles.tableCell, styles.colTaxRate]}>
                    {di.item.taxRate}%
                  </Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>
                    {formatCurrency(di.item.amount)}
                  </Text>
                </View>
              );
            })}

            {Array.from({ length: emptyRowsCount }).map((_, i) => (
              <View
                key={`empty-${i}`}
                style={
                  (displayItems.length + i) % 2 === 0
                    ? styles.tableRow
                    : styles.tableRowAlt
                }
              >
                <Text style={[styles.tableCell, styles.colDescription]}>
                  {" "}
                </Text>
              </View>
            ))}
          </View>

          {/* 小計・税額・合計 + 振込先（2カラム） */}
          <View style={styles.summaryBankRow}>
            {/* 左: 振込先情報 */}
            <View style={styles.bankSection}>
              {bankAccount && (
                <>
                  <Text style={styles.bankTitle}>振込先：</Text>
                  {paymentDueDate && (
                    <View style={styles.bankRow}>
                      <Text style={styles.bankText}>
                        支払期限：{formatDate(paymentDueDate)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.bankRow}>
                    <Text style={styles.bankText}>
                      {bankAccount.bankName}　{bankAccount.branchName}({bankAccount.branchCode})
                    </Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankText}>
                      普通口座　{bankAccount.accountNumber}
                    </Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={styles.bankText}>
                      口座名義　{bankAccount.accountHolderName}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* 右: 小計・税額・合計 */}
            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>小計：</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(subtotal)}
                </Text>
              </View>

              {taxRates.map((rate) => (
                <View key={rate} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    消費税（{rate}%）：
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(taxSummary[rate].tax)}
                  </Text>
                </View>
              ))}

              <View style={styles.summaryTotalRow}>
                <Text style={styles.summaryTotalLabel}>合計：</Text>
                <Text style={styles.summaryTotalValue}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>
          </View>

          {/* 備考欄 */}
          {data.remarks && (
            <View style={styles.remarksSection}>
              <Text style={styles.remarksTitle}>備考欄</Text>
              <Text style={styles.remarksText}>{data.remarks}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
