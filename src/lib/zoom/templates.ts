// メッセージテンプレートの変数差込ユーティリティ。
// 対応プレースホルダー:
//   {{事業者名}} {{商談種別}} {{日時}} {{担当者}} {{url}}
//   {{要約}} {{弊社スタッフ一覧}} （AIプロンプト用）
// 不明な変数はそのまま残す（検知しやすいため）。

export type MessageVars = {
  事業者名?: string;
  商談種別?: string;
  日時?: string;
  担当者?: string;
  url?: string;
  要約?: string;
  弊社スタッフ一覧?: string;
  [k: string]: string | undefined;
};

export function renderTemplate(body: string, vars: MessageVars): string {
  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, keyRaw: string) => {
    const key = keyRaw.trim();
    const v = vars[key];
    return v === undefined ? match : v;
  });
}

// 日時を「2026/04/17（金）14:00」のような日本語表記に整形
export function formatJstDateTime(date: Date): string {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // ja-JPはデフォで「2026/04/17(金) 14:00」系になる
  return fmt.format(date);
}
