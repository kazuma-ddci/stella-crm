/**
 * プロラインから渡される予約日時文字列を Date にパースする
 *
 * プロラインのテンプレート変数 [[cl1-booking-start]] 等は以下のような
 * フォーマットで展開されることがある：
 *   - "2026/04/11 10:00:00"
 *   - "2026/04/11 10:00"
 *   - "2026-04-11 10:00:00"
 *   - "2026-04-11T10:00:00"
 *   - "2026年4月11日 10時00分"
 *   - "2026年4月11日 10:00"
 *
 * Node.js の `new Date()` は「2026/04/11 10:00」や日本語フォーマットを
 * 正しく解釈できないため、自前で対応する。
 */
export function parseReservationDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // ISO / ハイフン区切り: 2026-04-11T10:00:00 / 2026-04-11 10:00:00 / 2026-04-11 10:00
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );
  if (isoMatch) {
    const [, y, mo, d, h, mi, s] = isoMatch;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      s ? Number(s) : 0,
    );
    return isNaN(date.getTime()) ? null : date;
  }

  // スラッシュ区切り: 2026/04/11 10:00:00 / 2026/04/11 10:00
  const slashMatch = trimmed.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,
  );
  if (slashMatch) {
    const [, y, mo, d, h, mi, s] = slashMatch;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      s ? Number(s) : 0,
    );
    return isNaN(date.getTime()) ? null : date;
  }

  // 日本語: 2026年4月11日 10時00分 / 2026年4月11日 10:00
  const jpMatch = trimmed.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日[^\d]*(\d{1,2})[時:](\d{1,2})/,
  );
  if (jpMatch) {
    const [, y, mo, d, h, mi] = jpMatch;
    const date = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
    );
    return isNaN(date.getTime()) ? null : date;
  }

  // 日付のみ: 2026-04-11 / 2026/04/11 / 2026年4月11日
  const dateOnlyHyphen = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnlyHyphen) {
    const [, y, mo, d] = dateOnlyHyphen;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }
  const dateOnlySlash = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (dateOnlySlash) {
    const [, y, mo, d] = dateOnlySlash;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }
  const dateOnlyJp = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (dateOnlyJp) {
    const [, y, mo, d] = dateOnlyJp;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }

  // フォールバック: ネイティブパーサー
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}
