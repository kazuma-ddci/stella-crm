/**
 * 2つのオブジェクトの差分を計算する。
 * 日付はYYYY-MM-DD文字列に変換して比較。
 */
export function calcChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldLabels?: Record<string, string>
): Record<string, { old: unknown; new: unknown }> | null {
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of Object.keys(newData)) {
    if (key === "updatedAt" || key === "createdAt") continue;
    const newVal = newData[key];
    if (
      newVal !== null &&
      newVal !== undefined &&
      typeof newVal === "object" &&
      !Array.isArray(newVal) &&
      !(newVal instanceof Date)
    )
      continue;

    const oldVal = oldData[key];

    const normalizeVal = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toISOString().split("T")[0];
      return String(v);
    };

    if (normalizeVal(oldVal) !== normalizeVal(newVal)) {
      const label = fieldLabels?.[key] ?? key;
      diff[label] = {
        old: oldVal instanceof Date
          ? oldVal.toISOString().split("T")[0]
          : oldVal ?? null,
        new: newVal instanceof Date
          ? (newVal as Date).toISOString().split("T")[0]
          : newVal ?? null,
      };
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
}
