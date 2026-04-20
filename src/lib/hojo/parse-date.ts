// 日付文字列（YYYY-MM-DD）を UTC 00:00 の Date に変換する。
// プロジェクト内では DateTime カラムへ UTC midnight で保存するのが慣例で、
// 読み出し側は `.toISOString().slice(0, 10)` で日付部分を抽出している。
// タイムゾーン不一致による前日／翌日ずれを防ぐため UTC で固定する。
// 形式不正や Invalid Date は null を返す（Prisma に Invalid Date を渡さない）。
export function parseYmdDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}
