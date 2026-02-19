/**
 * フィールド変更履歴 - 純粋関数（クライアント/サーバー共用）
 * Prisma非依存のため、クライアントコンポーネントからもimport可能
 */

export type FieldChange = {
  fieldName: string;
  displayName: string;
  oldValue: string | null;
  newValue: string | null;
  note: string;
};

export type StaffEntry = { id: number; name: string };

/**
 * 複数選択スタッフの集合比較（順序無関係）
 * @returns true = 同じ集合（差分なし）
 */
export function isStaffSetEqual(
  oldEntries: StaffEntry[],
  newEntries: StaffEntry[],
): boolean {
  if (oldEntries.length !== newEntries.length) return false;
  const oldIds = new Set(oldEntries.map((e) => e.id));
  return newEntries.every((e) => oldIds.has(e.id));
}

/**
 * スタッフエントリをIDソートで正規化し「名前(ID:xx)」形式の文字列に変換
 */
export function formatStaffEntries(entries: StaffEntry[]): string | null {
  if (entries.length === 0) return null;
  return [...entries]
    .sort((a, b) => a.id - b.id)
    .map((e) => `${e.name}(ID:${e.id})`)
    .join(", ");
}

/**
 * 変更メモのバリデーション（空白トリム後に空文字でないか）
 */
export function isValidChangeNote(note: string | undefined | null): boolean {
  if (note == null) return false;
  return note.trim().length > 0;
}
