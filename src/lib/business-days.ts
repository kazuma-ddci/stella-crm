import holidayJp from "@holiday-jp/holiday_jp";

// 祝日判定
export function isHoliday(date: Date): boolean {
  return holidayJp.isHoliday(date);
}

// 営業日判定（土日祝以外）
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !isHoliday(date);
}

// N営業日後の日付を取得
export function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      remaining--;
    }
  }
  return result;
}

// 月の日数を取得
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 月額の日割り計算（繰り上げ）
export function calculateProratedFee(
  monthlyFee: number,
  startDay: number,
  totalDaysInMonth: number
): number {
  const remainingDays = totalDaysInMonth - startDay + 1;
  return Math.ceil((monthlyFee * remainingDays) / totalDaysInMonth);
}
