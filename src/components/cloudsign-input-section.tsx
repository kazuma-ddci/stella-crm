"use client";

/**
 * 締結完了時にお客様が CloudSign 上で契約書に入力した widget 値を表示する共通コンポーネント。
 *
 * 元は src/app/slp/members/slp-contract-modal.tsx 内のローカル定義。
 * SLP 契約書管理ページのサイドパネルからも参照したいので共通化した。
 */

export type CloudsignInputData = {
  capturedAt: string;
  documentId?: string;
  widgets: Array<{
    label: string | null;
    text: string;
    widgetType: number;
    widgetTypeName: string;
    page: number;
    status: number;
    participantId: string;
    participantEmail: string | null;
  }>;
};

type Props = {
  data: CloudsignInputData;
  /** 見出しを表示するか（サイドパネル等で外側に見出しがある場合はfalse） */
  showHeader?: boolean;
  /** 背景色を抑えたバリアント */
  plain?: boolean;
};

export function CloudsignInputSection({ data, showHeader = true, plain = false }: Props) {
  // レガシー/不正データ対応: widgets が配列でない場合は空扱い
  const widgets = Array.isArray(data.widgets) ? data.widgets : [];

  // 受信者ごとにグルーピング
  const byParticipant = new Map<string, typeof widgets>();
  for (const w of widgets) {
    const key = w.participantEmail ?? w.participantId ?? "unknown";
    if (!byParticipant.has(key)) byParticipant.set(key, []);
    byParticipant.get(key)!.push(w);
  }

  // capturedAt の安全な日時表示
  const capturedDate = data.capturedAt ? new Date(data.capturedAt) : null;
  const capturedAtLabel =
    capturedDate && !Number.isNaN(capturedDate.getTime())
      ? capturedDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
      : null;

  return (
    <div className={plain ? "" : "border-t px-4 py-3 bg-blue-50/30"}>
      {showHeader && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-blue-900">
            📝 お客様が契約書に入力した内容
          </span>
          {capturedAtLabel && (
            <span className="text-[10px] text-gray-400">
              取得日時: {capturedAtLabel}
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        {Array.from(byParticipant.entries()).map(([participantKey, participantWidgets]) => {
          const firstWithEmail = participantWidgets.find((w) => w.participantEmail);
          const label = firstWithEmail?.participantEmail ?? participantKey;
          // フリーテキスト(1), チェックボックス(2) を優先表示、署名(0) は最後
          const sorted = [...participantWidgets].sort((a, b) => {
            const order = (t: number) => (t === 1 ? 0 : t === 2 ? 1 : 2);
            return order(a.widgetType) - order(b.widgetType) || a.page - b.page;
          });
          return (
            <div key={participantKey} className="rounded border border-blue-100 bg-white p-2">
              <div className="text-[10px] text-gray-500 mb-1.5">参加者: {label}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                {sorted.map((w, i) => {
                  const labelText = w.label || `（ラベルなし / ページ ${w.page} / ${w.widgetTypeName}）`;
                  let valueNode;
                  if (w.widgetType === 0) {
                    // 署名
                    valueNode =
                      w.status === 1 ? (
                        <span className="text-green-700 font-medium">押印済み</span>
                      ) : (
                        <span className="text-gray-400">未押印</span>
                      );
                  } else if (w.widgetType === 2) {
                    // チェックボックス
                    valueNode =
                      w.text === "1" ? (
                        <span className="text-green-700">✓ チェック</span>
                      ) : (
                        <span className="text-gray-400">未チェック</span>
                      );
                  } else {
                    // フリーテキスト
                    valueNode = w.text ? (
                      <span className="text-gray-900 whitespace-pre-wrap">{w.text}</span>
                    ) : (
                      <span className="text-gray-400">（未入力）</span>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="flex items-baseline gap-2 text-xs border-b border-gray-100 py-1 last:border-b-0"
                    >
                      <span className="text-gray-500 shrink-0 min-w-[6rem]">{labelText}</span>
                      <span className="flex-1">{valueNode}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
