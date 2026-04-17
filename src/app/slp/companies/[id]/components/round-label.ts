// 打ち合わせ番号のユーザー向け表記（初回 / 2回目 / 3回目 ...）
export function formatRoundNumber(n: number): string {
  return n === 1 ? "初回" : `${n}回目`;
}
