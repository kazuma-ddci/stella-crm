import { toLocalDateString } from "@/lib/utils";

export function formatValue(value: unknown, type?: string, options?: { value: string; label: string }[]): string {
  if (value === null || value === undefined) return "-";
  if (type === "password") return value ? "••••••••" : "-";
  if (typeof value === "boolean") return value ? "有効" : "無効";
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    return value.join(", ");
  }
  // selectタイプ: valueをlabelに変換
  if (type === "select" && options) {
    const option = options.find((opt) => opt.value === String(value));
    if (option) return option.label;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      // サーバー/クライアント間のHydrationエラーを防ぐため、タイムゾーンを明示的に指定
      const dateFormatOptions: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo" };
      if (type === "month") {
        return date.toLocaleDateString("ja-JP", {
          ...dateFormatOptions,
          year: "numeric",
          month: "2-digit",
        });
      }
      if (value.includes("T") && type !== "date") {
        return date.toLocaleString("ja-JP", {
          ...dateFormatOptions,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
      return date.toLocaleDateString("ja-JP", {
        ...dateFormatOptions,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
  }
  return String(value);
}

export function formatForInput(value: unknown, type?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      if (type === "datetime") {
        return date.toISOString().slice(0, 16);
      }
      if (type === "date" || type === "month") {
        return toLocalDateString(date);
      }
    }
  }
  return String(value);
}
