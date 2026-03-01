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
    accountNumber: string;
    accountHolderName: string;
  } | null;
};

// ============================================
// スタイル
// ============================================

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    padding: 48,
    backgroundColor: "#ffffff",
    color: "#1f2937",
  },
  // ヘッダー
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    width: 220,
    alignItems: "flex-end",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    letterSpacing: 8,
  },
  logo: {
    width: 100,
    height: 40,
    objectFit: "contain",
    marginBottom: 8,
  },
  // 宛先
  customerSection: {
    marginBottom: 20,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    paddingBottom: 4,
    marginBottom: 4,
  },
  honorific: {
    fontSize: 13,
    marginLeft: 4,
  },
  // 請求元情報
  issuerSection: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  issuerName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  issuerDetail: {
    fontSize: 8,
    color: "#4b5563",
    marginBottom: 1,
  },
  registrationNumber: {
    fontSize: 8,
    color: "#4b5563",
    marginTop: 2,
  },
  // 請求情報
  invoiceInfoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  invoiceInfoLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 80,
    textAlign: "right",
    marginRight: 8,
  },
  invoiceInfoValue: {
    fontSize: 9,
    fontWeight: "bold",
    width: 120,
    textAlign: "left",
  },
  // 合計金額ボックス
  totalBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  // 明細テーブル
  table: {
    marginBottom: 28,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#374151",
    paddingVertical: 8,
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
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: "#f9fafb",
  },
  tableCell: {
    fontSize: 10,
  },
  // カラム幅
  colDescription: { width: "40%" },
  colPeriod: { width: "25%" },
  colTaxRate: { width: "10%", textAlign: "right" as const },
  colAmount: { width: "25%", textAlign: "right" as const },
  // 小計・税額セクション
  summarySection: {
    alignItems: "flex-end",
    marginBottom: 28,
  },
  summaryRow: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  summaryTotalRow: {
    flexDirection: "row",
    width: 250,
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 2,
    borderTopColor: "#374151",
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#4b5563",
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "bold",
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: "bold",
  },
  // 振込先
  bankSection: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 4,
    padding: 12,
    marginBottom: 24,
  },
  bankTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
  },
  bankRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bankLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 80,
  },
  bankValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  // 備考
  note: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 16,
  },
});

// ============================================
// ヘルパー
// ============================================

function formatCurrency(value: number): string {
  return `\u00a5${value.toLocaleString("ja-JP")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
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
    taxAmount,
    totalAmount,
    bankAccount,
  } = data;

  const logoAbsPath = operatingCompany.logoPath
    ? path.join(process.cwd(), "public", operatingCompany.logoPath)
    : null;

  const taxRates = Object.keys(taxSummary).sort(
    (a, b) => Number(a) - Number(b)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* タイトル */}
        <Text style={styles.title}>請 求 書</Text>

        {/* ヘッダー: 左（宛先）・右（発行元） */}
        <View style={styles.header}>
          {/* 左: 宛先 */}
          <View style={styles.headerLeft}>
            <View style={styles.customerSection}>
              <Text style={styles.customerName}>
                {counterpartyName}
                <Text style={styles.honorific}> {data.honorific ?? "御中"}</Text>
              </Text>
            </View>

            {/* 合計金額ボックス */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>ご請求金額（税込）</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(totalAmount)}
              </Text>
            </View>
          </View>

          {/* 右: 発行元情報 */}
          <View style={styles.headerRight}>
            {/* ロゴ */}
            {logoAbsPath && <Image src={logoAbsPath} style={styles.logo} />}

            <View style={styles.issuerSection}>
              <Text style={styles.issuerName}>
                {operatingCompany.companyName}
              </Text>
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
              {operatingCompany.phone && (
                <Text style={styles.issuerDetail}>
                  TEL: {operatingCompany.phone}
                </Text>
              )}
              {operatingCompany.representativeName && (
                <Text style={styles.issuerDetail}>
                  代表: {operatingCompany.representativeName}
                </Text>
              )}
              {operatingCompany.registrationNumber && (
                <Text style={styles.registrationNumber}>
                  登録番号: {operatingCompany.registrationNumber}
                </Text>
              )}
            </View>

            {/* 請求情報 */}
            <View style={{ marginTop: 12 }}>
              <View style={styles.invoiceInfoRow}>
                <Text style={styles.invoiceInfoLabel}>請求書番号:</Text>
                <Text style={styles.invoiceInfoValue}>
                  {invoiceNumber ?? "（未採番）"}
                </Text>
              </View>
              <View style={styles.invoiceInfoRow}>
                <Text style={styles.invoiceInfoLabel}>請求日:</Text>
                <Text style={styles.invoiceInfoValue}>
                  {formatDate(invoiceDate)}
                </Text>
              </View>
              {paymentDueDate && (
                <View style={styles.invoiceInfoRow}>
                  <Text style={styles.invoiceInfoLabel}>お支払期限:</Text>
                  <Text style={styles.invoiceInfoValue}>
                    {formatDate(paymentDueDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 明細テーブル */}
        <View style={styles.table}>
          {/* ヘッダー行 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>
              品目・摘要
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

          {/* 明細行 */}
          {(() => {
            const memoLines = data.memoLines ?? [];
            const order = data.lineOrder;

            type DisplayItem =
              | { type: "tx"; item: typeof lineItems[number] }
              | { type: "memo"; memo: { description: string } };

            let displayItems: DisplayItem[];

            if (order && order.length > 0) {
              // IDベースで取引をマッピング
              const txMap = new Map(lineItems.map((item) => [item.id, item]));
              const usedTxIds = new Set<number>();

              displayItems = [];
              for (const key of order) {
                if (key.startsWith("memo:")) {
                  const memoId = parseInt(key.split(":")[1], 10);
                  const memo = memoLines.find((m) => m.id === memoId);
                  displayItems.push({ type: "memo" as const, memo: memo ?? { description: "" } });
                } else {
                  const txId = parseInt(key.split(":")[1], 10);
                  const item = txMap.get(txId);
                  if (item && !usedTxIds.has(txId)) {
                    usedTxIds.add(txId);
                    displayItems.push({ type: "tx" as const, item });
                  }
                }
              }
              // lineOrderに含まれなかった取引を末尾に追加
              for (const item of lineItems) {
                if (!usedTxIds.has(item.id)) {
                  displayItems.push({ type: "tx" as const, item });
                }
              }
            } else {
              displayItems = lineItems.map((item) => ({ type: "tx" as const, item }));
            }

            return displayItems.map((di, i) => {
              if (di.type === "memo") {
                return (
                  <View key={`memo-${i}`} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { width: "100%" }]}>{di.memo.description}</Text>
                  </View>
                );
              }
              return (
                <View key={`tx-${di.item.id}`} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.tableCell, styles.colDescription]}>{di.item.description}</Text>
                  <Text style={[styles.tableCell, styles.colPeriod]}>{di.item.period}</Text>
                  <Text style={[styles.tableCell, styles.colTaxRate]}>{di.item.taxRate}%</Text>
                  <Text style={[styles.tableCell, styles.colAmount]}>{formatCurrency(di.item.amount)}</Text>
                </View>
              );
            });
          })()}
        </View>

        {/* 小計・税額・合計 */}
        <View style={styles.summarySection}>
          {/* 小計 */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>小計</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(subtotal)}
            </Text>
          </View>

          {/* 税率別消費税 */}
          {taxRates.map((rate) => (
            <View key={rate} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                消費税（{rate}%）
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(taxSummary[rate].tax)}
              </Text>
            </View>
          ))}

          {/* 合計 */}
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>合計（税込）</Text>
            <Text style={styles.summaryTotalValue}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* 振込先情報 */}
        {bankAccount && (
          <View style={styles.bankSection}>
            <Text style={styles.bankTitle}>お振込先</Text>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>金融機関:</Text>
              <Text style={styles.bankValue}>{bankAccount.bankName}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>支店名:</Text>
              <Text style={styles.bankValue}>{bankAccount.branchName}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>口座番号:</Text>
              <Text style={styles.bankValue}>
                普通 {bankAccount.accountNumber}
              </Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>口座名義:</Text>
              <Text style={styles.bankValue}>
                {bankAccount.accountHolderName}
              </Text>
            </View>
          </View>
        )}

        {/* 備考欄 */}
        {data.remarks && (
          <View style={{ marginTop: 12, marginBottom: 8, borderWidth: 1, borderColor: "#9ca3af" }}>
            <View
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#9ca3af",
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  textAlign: "center",
                  letterSpacing: 8,
                }}
              >
                備　考
              </Text>
            </View>
            <View style={{ padding: 8, minHeight: 48 }}>
              <Text style={{ fontSize: 9, color: "#1f2937" }}>{data.remarks}</Text>
            </View>
          </View>
        )}

        {/* 注記 */}
        <Text style={styles.note}>
          ※ 上記金額のお振込みをお願い申し上げます。振込手数料は貴社ご負担にてお願いいたします。
        </Text>
      </Page>
    </Document>
  );
}
