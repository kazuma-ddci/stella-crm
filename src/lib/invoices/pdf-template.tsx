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
const WAVE_PATH = path.join(process.cwd(), "public/images/invoice-wave.png");
const WATERMARK_PATH = path.join(process.cwd(), "public/images/invoice-watermark.png");
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
    right: 0,
    height: 50,
  },
  watermark: {
    position: "absolute",
    bottom: 100,
    left: 198,
    width: 200,
    height: 200,
    opacity: 0.15,
  },
  content: {
    padding: 48,
    paddingTop: 60,
  },
  // 上部メタ情報
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  metaLeft: {
    flexDirection: "column",
  },
  metaLine: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    fontSize: 8,
    color: "#6b7280",
    width: 65,
  },
  metaValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  logoContainer: {
    alignItems: "flex-end",
  },
  logo: {
    width: 160,
    height: 52,
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
    marginBottom: 28,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 20,
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
  totalBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 2,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 6,
    marginBottom: 12,
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
    fontSize: 7,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "right",
  },
  // 明細テーブル
  table: {
    marginBottom: 20,
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
  colDescription: { width: "40%" },
  colPeriod: { width: "25%" },
  colTaxRate: { width: "10%", textAlign: "right" as const },
  colAmount: { width: "25%", textAlign: "right" as const },
  // 小計・税額セクション
  summarySection: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  summaryLabel: {
    fontSize: 9,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  summaryTotalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f3f4f6",
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 11,
    fontWeight: "bold",
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  // 振込先
  bankSection: {
    marginTop: 8,
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
  },
  bankRow: {
    marginBottom: 2,
  },
  bankText: {
    fontSize: 8,
    color: "#374151",
  },
  // 備考
  remarksSection: {
    marginTop: 24,
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

        {/* ウォーターマーク */}
        <Image src={WATERMARK_PATH} style={styles.watermark} />

        {/* メインコンテンツ */}
        <View style={styles.content}>
          {/* 上部: 請求書番号・発行日（左・縦並び） + ロゴ（右） */}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <View style={styles.metaLine}>
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
                下記のとおり、請求いたします
              </Text>

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>合計金額</Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(totalAmount)}円(税込)
                </Text>
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

          {/* 小計・税額・合計 */}
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

          {/* 振込先情報 */}
          {bankAccount && (
            <View style={styles.bankSection}>
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
            </View>
          )}

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
