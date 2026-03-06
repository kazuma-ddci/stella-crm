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
    address2: string | null;
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
    branchCode: string;
    accountNumber: string;
    accountHolderName: string;
  } | null;
  remarks: string | null;
};

// ============================================
// 定数
// ============================================

const MIN_TABLE_ROWS = 8;

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

  lineItems.forEach((item, index) => {
    if (!usedTxIds.has(item.id)) {
      ordered.push({ type: "transaction", item, index });
    }
  });

  memoLines.forEach((ml) => {
    if (!usedMemoIds.has(ml.id)) {
      ordered.push({ type: "memo", memo: ml });
    }
  });

  return ordered;
}

// ============================================
// A4サイズ定数
// ============================================
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

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

  const emptyRowsCount = Math.max(0, MIN_TABLE_ROWS - orderedLines.length);

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
          overflow: "hidden",
        }}
        className="border border-gray-300 shadow-sm"
      >
        {/* ウェーブ装飾（上部・全幅カバー） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/invoice-wave.png"
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: -1,
            width: "calc(100% + 2px)",
            height: 50,
            objectFit: "fill",
          }}
        />

        {/* ウォーターマーク（中央下部・アスペクト比保持） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/invoice-watermark.png"
          alt=""
          style={{
            position: "absolute",
            bottom: 100,
            left: "50%",
            width: 200,
            transform: "translateX(-50%)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />

        {/* メインコンテンツ */}
        <div style={{ padding: 48, paddingTop: 60, position: "relative" }}>
          {/* 上部: 請求書番号・発行日（左・縦並び） + ロゴ（右） */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ display: "flex", marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: "#6b7280", width: 65 }}>請求書番号：</span>
                <span style={{ fontSize: 9, fontWeight: "bold" }}>
                  {invoiceNumber ?? "（未採番）"}
                </span>
              </div>
              <div style={{ display: "flex", marginBottom: 2 }}>
                <span style={{ fontSize: 8, color: "#6b7280", width: 65 }}>請求発行日：</span>
                <span style={{ fontSize: 9, fontWeight: "bold" }}>
                  {formatDate(invoiceDate)}
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/stp-logo.png"
                alt="STELLA"
                style={{ width: 160, height: 52, objectFit: "contain" }}
              />
            </div>
          </div>

          {/* 区切り線 */}
          <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 16 }} />

          {/* ヘッダー: 左（宛先＋合計）・右（請求書タイトル＋発行元） */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
            {/* 左: 宛先 */}
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: "bold",
                  borderBottom: "1px solid #1f2937",
                  paddingBottom: 4,
                  marginBottom: 6,
                }}
              >
                {counterpartyName}
                <span style={{ fontSize: 13, marginLeft: 8 }}>{honorific}</span>
              </div>
              <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 16 }}>
                下記のとおり、請求いたします
              </div>

              {/* 合計金額ボックス */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "#f3f4f6",
                  borderRadius: 2,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingLeft: 16,
                  paddingRight: 16,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: "bold", color: "#374151" }}>
                  合計金額
                </span>
                <span style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}>
                  {formatCurrency(totalAmount)}円(税込)
                </span>
              </div>
            </div>

            {/* 右: 請求書タイトル + 発行元情報 */}
            <div style={{ width: 220, textAlign: "right" }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: "bold",
                  letterSpacing: 6,
                  marginBottom: 12,
                  textAlign: "right",
                }}
              >
                請求書
              </div>
              <div style={{ textAlign: "right" }}>
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
                {operatingCompany.address2 && (
                  <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 1 }}>
                    {operatingCompany.address2}
                  </div>
                )}
                <div style={{ fontSize: 10, fontWeight: "bold", marginTop: 4 }}>
                  {operatingCompany.companyName}
                </div>
                {operatingCompany.registrationNumber && (
                  <div style={{ fontSize: 7, color: "#6b7280", marginTop: 2 }}>
                    登録番号: {operatingCompany.registrationNumber}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 明細テーブル */}
          <div style={{ marginBottom: 20 }}>
            {/* ヘッダー行 */}
            <div
              style={{
                display: "flex",
                backgroundColor: "#9ca3af",
                paddingTop: 7,
                paddingBottom: 7,
                paddingLeft: 8,
                paddingRight: 8,
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: 9,
              }}
            >
              <div style={{ width: "40%" }}>摘要</div>
              <div style={{ width: "25%" }}>対象期間</div>
              <div style={{ width: "10%", textAlign: "right" }}>税率</div>
              <div style={{ width: "25%", textAlign: "right" }}>金額（税抜）</div>
            </div>

            {/* データ行 */}
            {orderedLines.map((line, i) => {
              if (line.type === "memo") {
                return (
                  <div
                    key={`memo-${line.memo.id}`}
                    style={{
                      borderBottom: "0.5px solid #e5e7eb",
                      paddingTop: 7,
                      paddingBottom: 7,
                      paddingLeft: 8,
                      paddingRight: 8,
                      backgroundColor: i % 2 === 0 ? "transparent" : "#f9fafb",
                      fontSize: 9,
                      minHeight: 26,
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
                    paddingTop: 7,
                    paddingBottom: 7,
                    paddingLeft: 8,
                    paddingRight: 8,
                    backgroundColor: i % 2 === 0 ? "transparent" : "#f9fafb",
                    fontSize: 9,
                    minHeight: 26,
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

            {/* 空行で埋める */}
            {Array.from({ length: emptyRowsCount }).map((_, i) => (
              <div
                key={`empty-${i}`}
                style={{
                  borderBottom: "0.5px solid #e5e7eb",
                  paddingTop: 7,
                  paddingBottom: 7,
                  paddingLeft: 8,
                  paddingRight: 8,
                  backgroundColor:
                    (orderedLines.length + i) % 2 === 0 ? "transparent" : "#f9fafb",
                  minHeight: 26,
                }}
              >
                &nbsp;
              </div>
            ))}
          </div>

          {/* 小計・税額・合計 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 220,
                paddingTop: 3,
                paddingBottom: 3,
                borderBottom: "0.5px solid #e5e7eb",
              }}
            >
              <span style={{ fontSize: 9, color: "#4b5563" }}>小計：</span>
              <span style={{ fontSize: 10, fontWeight: "bold" }}>
                {formatCurrency(subtotal)}
              </span>
            </div>

            {taxRates.map((rate) => (
              <div
                key={rate}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: 220,
                  paddingTop: 3,
                  paddingBottom: 3,
                  borderBottom: "0.5px solid #e5e7eb",
                }}
              >
                <span style={{ fontSize: 9, color: "#4b5563" }}>
                  消費税（{rate}%）：
                </span>
                <span style={{ fontSize: 10, fontWeight: "bold" }}>
                  {formatCurrency(taxSummary[rate].tax)}
                </span>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 220,
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 8,
                paddingRight: 8,
                backgroundColor: "#f3f4f6",
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: "bold" }}>合計：</span>
              <span style={{ fontSize: 14, fontWeight: "bold" }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* 振込先情報 */}
          {bankAccount && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: "bold", marginBottom: 6 }}>
                振込先：
              </div>
              {paymentDueDate && (
                <div style={{ fontSize: 8, color: "#374151", marginBottom: 2 }}>
                  支払期限：{formatDate(paymentDueDate)}
                </div>
              )}
              <div style={{ fontSize: 8, color: "#374151", marginBottom: 2 }}>
                {bankAccount.bankName}　{bankAccount.branchName}({bankAccount.branchCode})
              </div>
              <div style={{ fontSize: 8, color: "#374151", marginBottom: 2 }}>
                普通口座　{bankAccount.accountNumber}
              </div>
              <div style={{ fontSize: 8, color: "#374151", marginBottom: 2 }}>
                口座名義　{bankAccount.accountHolderName}
              </div>
            </div>
          )}

          {/* 備考欄 */}
          {remarks && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>
                備考欄
              </div>
              <div style={{ fontSize: 8, color: "#4b5563", whiteSpace: "pre-wrap" }}>
                {remarks}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
