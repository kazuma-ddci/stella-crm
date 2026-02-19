export const VALID_JOB_MEDIA_VALUES = ["Airワーク", "Wantedly", "求人ボックス"] as const;
export type ValidJobMedia = typeof VALID_JOB_MEDIA_VALUES[number];

export const JOB_MEDIA_OPTIONS = VALID_JOB_MEDIA_VALUES.map((v) => ({ value: v, label: v }));

export function isInvalidJobMedia(value: string | null | undefined): boolean {
  if (!value) return false;
  return !(VALID_JOB_MEDIA_VALUES as readonly string[]).includes(value);
}
