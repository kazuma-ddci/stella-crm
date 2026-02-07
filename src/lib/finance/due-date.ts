// 企業の締め日・支払条件から支払期限を自動計算
export function calcDueDate(params: {
  invoiceDate: Date;
  closingDay: number | null; // 0=月末, 1-28
  paymentMonthOffset: number | null; // 1=翌月, 2=翌々月, 3=3ヶ月後...
  paymentDay: number | null; // 0=末日, 1-28
}): Date | null {
  const { invoiceDate, closingDay, paymentMonthOffset, paymentDay } = params;

  if (paymentMonthOffset == null || paymentDay == null) return null;

  // 締め日を基準にする
  let baseDate = new Date(invoiceDate);

  if (closingDay != null) {
    if (closingDay === 0) {
      // 月末締め: 現在月の末日
      baseDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    } else {
      // N日締め: 現在月のN日。invoiceDateがN日を過ぎていれば翌月のN日
      const closingDate = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        closingDay
      );
      if (baseDate > closingDate) {
        baseDate = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth() + 1,
          closingDay
        );
      } else {
        baseDate = closingDate;
      }
    }
  }

  // 支払月: 締め日からNヶ月後
  const targetMonth = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth() + paymentMonthOffset,
    1
  );

  if (paymentDay === 0) {
    // 末日: その月の最終日
    return new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  }

  // 指定日
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), paymentDay);
}
