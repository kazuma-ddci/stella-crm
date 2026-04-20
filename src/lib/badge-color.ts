export type BadgeColor =
  | "amber"
  | "emerald"
  | "blue"
  | "purple"
  | "pink"
  | "cyan"
  | "red"
  | "gray";

export const PRESET_COLOR_OPTIONS: { value: BadgeColor; label: string }[] = [
  { value: "amber", label: "黄" },
  { value: "emerald", label: "緑" },
  { value: "blue", label: "青" },
  { value: "purple", label: "紫" },
  { value: "pink", label: "桃" },
  { value: "cyan", label: "水" },
  { value: "red", label: "赤" },
  { value: "gray", label: "灰" },
];

const BADGE_CLASS_MAP: Record<BadgeColor, string> = {
  amber: "bg-amber-100 text-amber-800 border border-amber-200",
  emerald: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  blue: "bg-blue-100 text-blue-800 border border-blue-200",
  purple: "bg-purple-100 text-purple-800 border border-purple-200",
  pink: "bg-pink-100 text-pink-800 border border-pink-200",
  cyan: "bg-cyan-100 text-cyan-800 border border-cyan-200",
  red: "bg-red-100 text-red-800 border border-red-200",
  gray: "bg-gray-100 text-gray-800 border border-gray-200",
};

export function getBadgeClasses(color: BadgeColor | string | null | undefined): string {
  const safe = (color ?? "gray") as BadgeColor;
  return BADGE_CLASS_MAP[safe] ?? BADGE_CLASS_MAP.gray;
}

export const COMPLETED_BADGE_CLASSES = BADGE_CLASS_MAP.emerald;
export const INCOMPLETE_BADGE_CLASSES = BADGE_CLASS_MAP.red;
