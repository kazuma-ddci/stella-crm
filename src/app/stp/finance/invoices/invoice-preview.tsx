"use client";

import { useRef, useState, useEffect, useMemo } from "react";

// ============================================
// 型定義
// ============================================

export type InvoicePreviewProps = {
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
  honorific: string;
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
  memoLines: { id: number; description: string }[];
  lineOrder: string[] | null;
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
  remarks: string | null;
};

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
// 明細行の構築（lineOrder対応）
// ============================================

type OrderedLine =
  | { type: "transaction"; item: InvoicePreviewProps["lineItems"][number]; index: number }
  | { type: "memo"; memo: InvoicePreviewProps["memoLines"][number] };

function buildOrderedLines(
  lineItems: InvoicePreviewProps["lineItems"],
  memoLines: InvoicePreviewProps["memoLines"],
  lineOrder: string[] | null
): OrderedLine[] {
  if (!lineOrder || lineOrder.length === 0) {
    return lineItems.map((item, index) => ({ type: "transaction", item, index }));
  }

  // IDベースで取引をマッピング
  const txMap = new Map<number, { item: InvoicePreviewProps["lineItems"][number]; index: number }>();
  lineItems.forEach((item, index) => {
    txMap.set(item.id, { item, index });
  });

  const memoMap = new Map<number, InvoicePreviewProps["memoLines"][number]>();
  memoLines.forEach((ml) => {
    memoMap.set(ml.id, ml);
  });

  const ordered: OrderedLine[] = [];
  const usedTxIds = new Set<number>();
  const usedMemoIds = new Set<number>();

  for (const key of lineOrder) {
    const [prefix, idStr] = key.split(":");
    const id = Number(idStr);
    if (prefix === "tx") {
      const txEntry = txMap.get(id);
      if (txEntry && !usedTxIds.has(id)) {
        usedTxIds.add(id);
        ordered.push({ type: "transaction", item: txEntry.item, index: txEntry.index });
      }
    } else if (prefix === "memo") {
      const memo = memoMap.get(id);
      if (memo && !usedMemoIds.has(id)) {
        usedMemoIds.add(id);
        ordered.push({ type: "memo", memo });
      }
    }
  }

  // lineOrder に含まれなかった取引を末尾に追加
  lineItems.forEach((item, index) => {
    if (!usedTxIds.has(item.id)) {
      ordered.push({ type: "transaction", item, index });
    }
  });

  // lineOrder に含まれなかったメモを末尾に追加
  memoLines.forEach((ml) => {
    if (!usedMemoIds.has(ml.id)) {
      ordered.push({ type: "memo", memo: ml });
    }
  });

  return ordered;
}

// ============================================
// A4サイズ定数（@react-pdfと同じpt単位）
// プレビューを595px幅で描画し、CSSスケーリングでコンテナに合わせる
// これによりPDFテンプレートと同じ数値を使って完全に一致させる
// ============================================
const A4_WIDTH = 595; // A4幅 in pt (= @react-pdfのPage幅)
const A4_HEIGHT = 842; // A4高さ in pt (= @react-pdfのPage高さ)

// ============================================
// コンポーネント
// ============================================

export function InvoicePreview(props: InvoicePreviewProps) {
  const {
    operatingCompany,
    counterpartyName,
    honorific,
    invoiceNumber,
    invoiceDate,
    paymentDueDate,
    lineItems,
    memoLines,
    lineOrder,
    taxSummary,
    subtotal,
    taxAmount,
    totalAmount,
    bankAccount,
    remarks,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const newScale = Math.min(containerRef.current.clientWidth / A4_WIDTH, 1);
        setScale(prev => prev === newScale ? prev : newScale);
      }
      if (contentRef.current) {
        const newHeight = contentRef.current.scrollHeight;
        setContentHeight(prev => prev === newHeight ? prev : newHeight);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const taxRates = useMemo(
    () => Object.keys(taxSummary).sort((a, b) => Number(a) - Number(b)),
    [taxSummary]
  );

  const orderedLines = useMemo(
    () => buildOrderedLines(lineItems, memoLines, lineOrder),
    [lineItems, memoLines, lineOrder]
  );

  // 全スタイル値はpdf-template.tsxのStyleSheetと完全一致させる
  return (
    <div
      ref={containerRef}
      className="w-full relative"
      style={{ height: contentHeight * scale }}
    >
      <div
        ref={contentRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: A4_WIDTH,
          minHeight: A4_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          fontFamily: "sans-serif",
          fontSize: 10,
          color: "#1f2937",
          backgroundColor: "#ffffff",
        }}
        className="border border-gray-300 shadow-sm"
      >
        {/* ページ内容: padding 48 = pdf-template.tsxのpage.padding */}
        <div style={{ padding: 48 }}>
          {/* タイトル: fontSize 24, marginBottom 30, letterSpacing 8 */}
          <div
            style={{
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 30,
              textAlign: "center",
              letterSpacing: 8,
            }}
          >
            請 求 書
          </div>

          {/* ヘッダー: marginBottom 36 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
            {/* 左: 宛先 */}
            <div style={{ flex: 1 }}>
              {/* 宛名セクション: marginBottom 20 */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: "bold",
                    borderBottom: "1px solid #1f2937",
                    paddingBottom: 4,
                    marginBottom: 4,
                  }}
                >
                  {counterpartyName}
                  <span style={{ fontSize: 13, marginLeft: 4 }}>
                    {honorific}
                  </span>
                </div>
              </div>

              {/* 合計金額ボックス: padding 12, marginBottom 20 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: "bold" }}>
                  ご請求金額（税込）
                </span>
                <span style={{ fontSize: 20, fontWeight: "bold" }}>
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* 右: 発行元情報: width 220 */}
            <div style={{ width: 220, textAlign: "right" }}>
              {/* ロゴ */}
              {operatingCompany.logoPath && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={operatingCompany.logoPath}
                    alt="ロゴ"
                    style={{ width: 100, height: 40, objectFit: "contain" }}
                  />
                </div>
              )}

              {/* 発行元詳細: marginBottom 4 */}
              <div style={{ textAlign: "right", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>
                  {operatingCompany.companyName}
                </div>
                {operatingCompany.postalCode && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 1 }}>
                    〒{operatingCompany.postalCode}
                  </div>
                )}
                {operatingCompany.address && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 1 }}>
                    {operatingCompany.address}
                  </div>
                )}
                {operatingCompany.phone && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 1 }}>
                    TEL: {operatingCompany.phone}
                  </div>
                )}
                {operatingCompany.representativeName && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 1 }}>
                    代表: {operatingCompany.representativeName}
                  </div>
                )}
                {operatingCompany.registrationNumber && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginTop: 2 }}>
                    登録番号: {operatingCompany.registrationNumber}
                  </div>
                )}
              </div>

              {/* 請求情報: marginTop 12 */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: "#6b7280", width: 80, textAlign: "right", marginRight: 8 }}>
                    請求書番号:
                  </span>
                  <span style={{ fontSize: 9, fontWeight: "bold", width: 120, textAlign: "left" }}>
                    {invoiceNumber ?? "（未採番）"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
                  <span style={{ fontSize: 9, color: "#6b7280", width: 80, textAlign: "right", marginRight: 8 }}>
                    請求日:
                  </span>
                  <span style={{ fontSize: 9, fontWeight: "bold", width: 120, textAlign: "left" }}>
                    {formatDate(invoiceDate)}
                  </span>
                </div>
                {paymentDueDate && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
                    <span style={{ fontSize: 9, color: "#6b7280", width: 80, textAlign: "right", marginRight: 8 }}>
                      お支払期限:
                    </span>
                    <span style={{ fontSize: 9, fontWeight: "bold", width: 120, textAlign: "left" }}>
                      {formatDate(paymentDueDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 明細テーブル: marginBottom 28 */}
          <div style={{ marginBottom: 28 }}>
            {/* ヘッダー行: paddingV 8, paddingH 8, fontSize 9 */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#374151",
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 8,
                paddingRight: 8,
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: 9,
              }}
            >
              <div style={{ width: "40%" }}>品目・摘要</div>
              <div style={{ width: "25%" }}>対象期間</div>
              <div style={{ width: "10%", textAlign: "right" }}>税率</div>
              <div style={{ width: "25%", textAlign: "right" }}>金額（税抜）</div>
            </div>

            {/* 明細行: paddingV 8, paddingH 8, fontSize 10 */}
            {orderedLines.map((line, i) => {
              if (line.type === "memo") {
                return (
                  <div
                    key={`memo-${line.memo.id}`}
                    style={{
                      borderBottom: "0.5px solid #e5e7eb",
                      paddingTop: 8,
                      paddingBottom: 8,
                      paddingLeft: 8,
                      paddingRight: 8,
                      backgroundColor: i % 2 === 0 ? "transparent" : "#f9fafb",
                      fontSize: 10,
                    }}
                  >
                    {line.memo.description}
                  </div>
                );
              }

              return (
                <div
                  key={`tx-${line.index}`}
                  style={{
                    display: "flex",
                    borderBottom: "0.5px solid #e5e7eb",
                    paddingTop: 8,
                    paddingBottom: 8,
                    paddingLeft: 8,
                    paddingRight: 8,
                    backgroundColor: i % 2 === 0 ? "transparent" : "#f9fafb",
                    fontSize: 10,
                  }}
                >
                  <div style={{ width: "40%" }}>{line.item.description}</div>
                  <div style={{ width: "25%" }}>{line.item.period}</div>
                  <div style={{ width: "10%", textAlign: "right" }}>
                    {line.item.taxRate}%
                  </div>
                  <div style={{ width: "25%", textAlign: "right" }}>
                    {formatCurrency(line.item.amount)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 小計・税額・合計: marginBottom 28 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 28 }}>
            {/* 小計: fontSize 10/11, paddingV 4 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 250,
                paddingTop: 4,
                paddingBottom: 4,
                borderBottom: "0.5px solid #e5e7eb",
              }}
            >
              <span style={{ fontSize: 10, color: "#4b5563" }}>
                小計
              </span>
              <span style={{ fontSize: 11, fontWeight: "bold" }}>
                {formatCurrency(subtotal)}
              </span>
            </div>

            {/* 税率別消費税 */}
            {taxRates.map((rate) => (
              <div
                key={rate}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: 250,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderBottom: "0.5px solid #e5e7eb",
                }}
              >
                <span style={{ fontSize: 10, color: "#4b5563" }}>
                  消費税（{rate}%）
                </span>
                <span style={{ fontSize: 11, fontWeight: "bold" }}>
                  {formatCurrency(taxSummary[rate].tax)}
                </span>
              </div>
            ))}

            {/* 合計: fontSize 12/15, paddingV 6, borderTop 2px */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 250,
                paddingTop: 6,
                paddingBottom: 6,
                borderTop: "2px solid #374151",
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: "bold" }}>
                合計（税込）
              </span>
              <span style={{ fontSize: 15, fontWeight: "bold" }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* 振込先情報: padding 12, marginBottom 24 */}
          {bankAccount && (
            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 4,
                padding: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  marginBottom: 8,
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 4,
                }}
              >
                お振込先
              </div>
              <div style={{ display: "flex", marginBottom: 3, fontSize: 9 }}>
                <span style={{ color: "#6b7280", width: 80 }}>金融機関:</span>
                <span style={{ fontWeight: "bold" }}>{bankAccount.bankName}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 3, fontSize: 9 }}>
                <span style={{ color: "#6b7280", width: 80 }}>支店名:</span>
                <span style={{ fontWeight: "bold" }}>{bankAccount.branchName}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 3, fontSize: 9 }}>
                <span style={{ color: "#6b7280", width: 80 }}>口座番号:</span>
                <span style={{ fontWeight: "bold" }}>普通 {bankAccount.accountNumber}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 3, fontSize: 9 }}>
                <span style={{ color: "#6b7280", width: 80 }}>口座名義:</span>
                <span style={{ fontWeight: "bold" }}>
                  {bankAccount.accountHolderName}
                </span>
              </div>
            </div>
          )}

          {/* 備考欄 */}
          {remarks && (
            <div style={{ marginTop: 12, marginBottom: 8, border: "1px solid #9ca3af" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  textAlign: "center",
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderBottom: "1px solid #9ca3af",
                  letterSpacing: 8,
                }}
              >
                備　考
              </div>
              <div style={{ fontSize: 9, color: "#1f2937", whiteSpace: "pre-wrap", padding: 8, minHeight: 48 }}>
                {remarks}
              </div>
            </div>
          )}

          {/* 注意書き: fontSize 9, marginTop 16 */}
          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 16 }}>
            ※
            上記金額のお振込みをお願い申し上げます。振込手数料は貴社ご負担にてお願いいたします。
          </div>
        </div>
      </div>
    </div>
  );
}
