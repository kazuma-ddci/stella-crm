import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * DateオブジェクトをローカルタイムゾーンでYYYY-MM-DD形式に変換する。
 * toISOString()はUTC変換するためJSTで日付が1日ずれる問題を回避する。
 */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
