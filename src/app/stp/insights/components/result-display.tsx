"use client";

import type { InsightResult } from "../types";

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return `¥${value.toLocaleString()}`;
    case "count":
      return value.toLocaleString();
    case "percent":
      return `${value}%`;
    case "days":
      return `${value}日`;
    default:
      return String(value);
  }
}

function ChangeIndicator({ changePercent }: { changePercent: number }) {
  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;
  return (
    <span
      className={
        isPositive
          ? "text-green-600"
          : isNegative
            ? "text-red-600"
            : "text-gray-500"
      }
    >
      {isPositive ? "+" : ""}
      {changePercent}%
    </span>
  );
}

function NumberDisplay({ result }: { result: Extract<InsightResult, { type: "number" }> }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{result.title}</h3>
      <div className="mb-2 text-3xl font-bold text-gray-900">
        {formatValue(result.value, result.format)}
      </div>
      {result.comparison && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <span>{result.comparison.label}: {formatValue(result.comparison.value, result.format)}</span>
          <ChangeIndicator changePercent={result.comparison.changePercent} />
        </div>
      )}
      {result.subItems && result.subItems.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 pt-3">
          {result.subItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{item.label}</span>
              <span className="font-medium text-gray-700">{formatValue(item.value, item.format)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownDisplay({ result }: { result: Extract<InsightResult, { type: "breakdown" }> }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-medium text-gray-500">{result.title}</h3>
      <div className="mb-3 text-lg font-bold text-gray-900">
        合計: {formatValue(result.total, result.format)}
      </div>
      {/* バー */}
      {result.items.length > 0 && (
        <div className="mb-3 flex h-4 overflow-hidden rounded-full">
          {result.items.map((item, i) => (
            <div
              key={i}
              className="transition-all"
              style={{
                width: `${item.percent}%`,
                backgroundColor: item.color ?? "#94A3B8",
                minWidth: item.percent > 0 ? "4px" : "0",
              }}
            />
          ))}
        </div>
      )}
      {/* 凡例 */}
      <div className="space-y-2">
        {result.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color ?? "#94A3B8" }}
              />
              <span className="text-gray-700">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-900">{formatValue(item.value, result.format)}</span>
              <span className="w-12 text-right text-gray-500">{item.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableDisplay({ result }: { result: Extract<InsightResult, { type: "table" }> }) {
  if (result.rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium text-gray-500">{result.title}</h3>
        <p className="text-sm text-gray-400">{result.emptyMessage ?? "データがありません"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-500">
        {result.title}
        <span className="ml-2 text-xs text-gray-400">({result.rows.length}件)</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {result.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-medium text-gray-600"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                {result.columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-gray-700">
                    {col.format === "currency" && typeof row[col.key] === "number"
                      ? formatValue(row[col.key] as number, "currency")
                      : col.format === "count" && typeof row[col.key] === "number"
                        ? formatValue(row[col.key] as number, "count")
                        : row[col.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankingDisplay({ result }: { result: Extract<InsightResult, { type: "ranking" }> }) {
  if (result.items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-medium text-gray-500">{result.title}</h3>
        <p className="text-sm text-gray-400">{result.emptyMessage ?? "データがありません"}</p>
      </div>
    );
  }

  const maxValue = Math.max(...result.items.map((i) => i.value), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{result.title}</h3>
      <div className="space-y-2">
        {result.items.map((item) => (
          <div key={item.rank} className="flex items-center gap-3">
            <span className="w-6 text-center text-sm font-bold text-gray-400">
              {item.rank}
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-gray-600">
                  {formatValue(item.value, result.format)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
              {item.detail && (
                <p className="mt-0.5 text-xs text-gray-400">{item.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendDisplay({ result }: { result: Extract<InsightResult, { type: "trend" }> }) {
  const values = result.months
    .filter((m) => m.value !== null)
    .map((m) => m.value as number);
  const maxValue = Math.max(...values, 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{result.title}</h3>
      {/* シンプルなバーチャート */}
      <div className="flex items-end gap-1" style={{ height: "120px" }}>
        {result.months.map((m, i) => {
          const barHeight = m.value !== null ? (m.value / maxValue) * 100 : 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative w-full flex-1 flex items-end">
                {m.target !== null && m.target !== undefined && (
                  <div
                    className="absolute inset-x-0 border-t-2 border-dashed border-orange-300"
                    style={{ bottom: `${(m.target / maxValue) * 100}%` }}
                  />
                )}
                <div
                  className="w-full rounded-t bg-blue-400 transition-all"
                  style={{ height: `${barHeight}%`, minHeight: m.value ? "2px" : "0" }}
                />
              </div>
              <span className="text-[10px] text-gray-500">{m.label}</span>
            </div>
          );
        })}
      </div>
      {/* 凡例 */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-2 w-4 rounded bg-blue-400" />
          <span>実績</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0 w-4 border-t-2 border-dashed border-orange-300" />
          <span>目標</span>
        </div>
      </div>
      {/* 数値テーブル */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            <tr>
              <td className="pr-2 text-gray-500">実績</td>
              {result.months.map((m, i) => (
                <td key={i} className="px-0.5 text-center text-gray-700">
                  {m.value !== null ? formatValue(m.value, result.format) : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="pr-2 text-gray-500">目標</td>
              {result.months.map((m, i) => (
                <td key={i} className="px-0.5 text-center text-gray-400">
                  {m.target !== null && m.target !== undefined ? formatValue(m.target, result.format) : "-"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryDisplay({ result }: { result: Extract<InsightResult, { type: "summary" }> }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{result.title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {result.cards.map((card, i) => (
          <div key={i} className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {formatValue(card.value, card.format)}
              </span>
              {card.changePercent !== undefined && card.changePercent !== 0 && (
                <ChangeIndicator changePercent={card.changePercent} />
              )}
            </div>
          </div>
        ))}
      </div>
      {result.details && result.details.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
          {result.details.map((d, i) => (
            <div key={i} className="flex items-start justify-between text-sm">
              <span className="text-gray-500">{d.label}</span>
              <span className="text-right text-gray-700">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResultDisplay({ result }: { result: InsightResult }) {
  switch (result.type) {
    case "number":
      return <NumberDisplay result={result} />;
    case "breakdown":
      return <BreakdownDisplay result={result} />;
    case "table":
      return <TableDisplay result={result} />;
    case "ranking":
      return <RankingDisplay result={result} />;
    case "trend":
      return <TrendDisplay result={result} />;
    case "summary":
      return <SummaryDisplay result={result} />;
    default:
      return null;
  }
}
