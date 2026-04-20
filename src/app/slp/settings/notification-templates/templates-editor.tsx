"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { updateNotificationTemplate } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2, Info, ChevronDown } from "lucide-react";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";

type TemplateRow = {
  id: number;
  recipient: string; // "customer" | "referrer"
  category: string; // "briefing" | "consultation"
  roundType: string | null; // "first" | "continuous" | null
  source: string | null; // "proline" | "manual" | null
  trigger: string;
  formId: string;
  label: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: { name: string } | null;
};

const TRIGGER_ORDER = [
  "confirm",
  "change",
  "cancel",
  "complete",
  "no_show",
  "remind_day_before",
  "remind_hour_before",
  "confirm_no_url",
  "change_no_url",
  "regenerated_manual_notice",
  // 紹介ライフサイクル
  "friend_added",
  "contract_signed",
  // 契約書関連（組合員向け）
  "contract_reminder",
  "contract_bounced",
];

const TRIGGER_LABELS: Record<string, string> = {
  confirm: "予約確定",
  change: "予約変更",
  cancel: "キャンセル",
  complete: "完了お礼",
  no_show: "不参加通知",
  remind_day_before: "リマインド（前日）",
  remind_hour_before: "リマインド（1時間前）",
  confirm_no_url: "予約確定（URLなし）",
  change_no_url: "予約変更（URLなし）",
  regenerated_manual_notice: "Zoom再発行のお知らせ",
  friend_added: "友達追加通知",
  contract_signed: "契約締結通知",
  contract_reminder: "契約書リマインド",
  contract_bounced: "メール不達通知",
};

const ROUND_TYPE_LABELS: Record<string, string> = {
  first: "初回",
  continuous: "2回目以降",
};

const SOURCE_LABELS: Record<string, string> = {
  proline: "プロライン経由",
  manual: "手動セット",
};

function groupKey(r: TemplateRow): string {
  return `${r.roundType ?? "_"}|${r.source ?? "_"}`;
}

function groupTitle(r: TemplateRow): string {
  const parts: string[] = [];
  if (r.roundType) parts.push(ROUND_TYPE_LABELS[r.roundType] ?? r.roundType);
  if (r.source) parts.push(SOURCE_LABELS[r.source] ?? r.source);
  if (parts.length === 0) return "共通";
  return parts.join(" × ");
}

function sortByTrigger(a: TemplateRow, b: TemplateRow): number {
  return TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger);
}

interface TemplateCardProps {
  row: TemplateRow;
  edit: { body: string; isActive: boolean };
  saved: { body: string; isActive: boolean };
  onEditChange: (id: number, patch: Partial<{ body: string; isActive: boolean }>) => void;
  busy: boolean;
  onSave: (id: number) => void;
}

function TemplateCard({ row, edit, saved, onEditChange, busy, onSave }: TemplateCardProps) {
  // 保存ボタンは「入力中の値 ≠ 最後に保存した値」の時だけアクティブ色になる。
  // saved は props の row ではなく親でキャッシュしている値を使うことで、
  // 保存直後に router.refresh() の反映を待たずに即座にグレーに戻せる。
  const changed = edit.body !== saved.body || edit.isActive !== saved.isActive;
  const triggerLabel = TRIGGER_LABELS[row.trigger] ?? row.trigger;

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{triggerLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.label} / {row.formId}
            {row.updatedBy && (
              <> ・ 最終更新: {row.updatedBy.name} ({new Intl.DateTimeFormat("ja-JP").format(new Date(row.updatedAt))})</>
            )}
          </div>
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={edit.isActive}
            onChange={(ev) => onEditChange(row.id, { isActive: ev.target.checked })}
          />
          有効
        </label>
      </div>
      <Textarea
        value={edit.body}
        onChange={(ev) => onEditChange(row.id, { body: ev.target.value })}
        className="font-mono text-xs"
        rows={6}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => onSave(row.id)} disabled={!changed || busy}>
          {busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          保存
        </Button>
      </div>
    </div>
  );
}

export function TemplatesEditor({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, { body: string; isActive: boolean }>>(
    () => Object.fromEntries(rows.map((r) => [r.id, { body: r.body, isActive: r.isActive }]))
  );
  // 「最後に保存した値」のキャッシュ。保存ボタンの色制御に使う（props の row を直接比較するとrefreshのタイムラグで色が残る問題の対策）
  const [savedValues, setSavedValues] = useState<Record<number, { body: string; isActive: boolean }>>(
    () => Object.fromEntries(rows.map((r) => [r.id, { body: r.body, isActive: r.isActive }]))
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleEditChange = (
    id: number,
    patch: Partial<{ body: string; isActive: boolean }>
  ) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // どこか1件でも未保存の変更があるか（ブラウザ離脱警告 / 遷移ガード用）
  const isDirty = useMemo(() => {
    for (const r of rows) {
      const e = edits[r.id];
      const s = savedValues[r.id] ?? { body: r.body, isActive: r.isActive };
      if (!e) continue;
      if (e.body !== s.body || e.isActive !== s.isActive) return true;
    }
    return false;
  }, [rows, edits, savedValues]);

  // ブラウザを閉じる / リロード / URL直接変更 時の警告（ブラウザ標準ダイアログ）
  useNavigationGuard(isDirty);

  // <a>クリックによる遷移をインターセプト（Next.js Link 含む）
  const guardNavigation = useCallback(
    (e: MouseEvent) => {
      if (!isDirty) return;
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return;
      if (!confirm("編集したテンプレートが保存されていませんがよろしいですか？")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isDirty]
  );

  useEffect(() => {
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [guardNavigation]);

  const handleSave = async (id: number) => {
    setBusyId(id);
    try {
      const r = await updateNotificationTemplate({
        id,
        body: edits[id].body,
        isActive: edits[id].isActive,
      });
      if (r.ok) {
        toast.success("テンプレートを保存しました");
        // 楽観的に「保存済み値」キャッシュを入力値で更新 → 保存ボタンが即座にグレーへ戻る
        setSavedValues((prev) => ({
          ...prev,
          [id]: { body: edits[id].body, isActive: edits[id].isActive },
        }));
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setBusyId(null);
    }
  };

  // タブ: お客様-概要案内、お客様-導入希望商談、紹介者向け、組合員向け
  // 紹介者向けは さらに「商談まわり(category=briefing)」と「紹介ライフサイクル(category=referral)」に分割
  const tabs = useMemo(() => {
    const customerBriefing = rows.filter(
      (r) => r.recipient === "customer" && r.category === "briefing"
    );
    const customerConsultation = rows.filter(
      (r) => r.recipient === "customer" && r.category === "consultation"
    );
    const referrerBriefing = rows.filter(
      (r) => r.recipient === "referrer" && r.category === "briefing"
    );
    const referrerReferral = rows.filter(
      (r) => r.recipient === "referrer" && r.category === "referral"
    );
    const memberContract = rows.filter(
      (r) => r.recipient === "member" && r.category === "contract"
    );
    return {
      customerBriefing,
      customerConsultation,
      referrerBriefing,
      referrerReferral,
      referrerTotal: referrerBriefing.length + referrerReferral.length,
      memberContract,
      memberTotal: memberContract.length,
    };
  }, [rows]);

  const renderGrouped = (list: TemplateRow[]) => {
    // roundType × source でグループ化
    const groups = new Map<string, TemplateRow[]>();
    for (const r of list) {
      const k = groupKey(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    // グループをソート（first→continuous / proline→manual / null最後）
    const order = ["first|proline", "first|manual", "continuous|proline", "continuous|manual", "_|_"];
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-2">
        {sortedKeys.map((k) => {
          const groupRows = groups.get(k)!.sort(sortByTrigger);
          const title = groupTitle(groupRows[0]);
          return (
            <details key={k} open className="group border rounded-lg">
              <summary className="px-4 py-3 cursor-pointer select-none flex items-center gap-2 hover:bg-muted/30">
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-0 -rotate-90" />
                <span className="font-semibold text-sm">{title}</span>
                <span className="text-xs text-muted-foreground">({groupRows.length}件)</span>
              </summary>
              <div className="px-4 pb-4 pt-1 space-y-3">
                {groupRows.map((r) => (
                  <TemplateCard
                    key={r.id}
                    row={r}
                    edit={edits[r.id]}
                    saved={savedValues[r.id] ?? { body: r.body, isActive: r.isActive }}
                    onEditChange={handleEditChange}
                    busy={busyId === r.id}
                    onSave={handleSave}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-blue-50/50 p-3 text-sm space-y-2">
        <div className="font-semibold flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          利用可能な変数（本文中に書くと送信時に置換）
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <li><code className="bg-white px-1 rounded">{"{{companyName}}"}</code> 事業者名</li>
          <li><code className="bg-white px-1 rounded">{"{{scheduledAt}}"}</code> 商談日時</li>
          <li><code className="bg-white px-1 rounded">{"{{staffName}}"}</code> 担当者名</li>
          <li><code className="bg-white px-1 rounded">{"{{zoomUrl}}"}</code> Zoom URL</li>
          <li><code className="bg-white px-1 rounded">{"{{referrerName}}"}</code> 紹介者名</li>
          <li><code className="bg-white px-1 rounded">{"{{addedFriendLineName}}"}</code> 友達追加通知: 追加された人のLINE名</li>
          <li><code className="bg-white px-1 rounded">{"{{memberName}}"}</code> 組合員氏名（契約締結通知・契約書関連通知）</li>
          <li><code className="bg-white px-1 rounded">{"{{memberLineName}}"}</code> 契約締結通知: 組合員LINE名</li>
          <li><code className="bg-white px-1 rounded">{"{{contractSentDate}}"}</code> 契約書リマインド: 送付日</li>
          <li><code className="bg-white px-1 rounded">{"{{contractSentEmail}}"}</code> 契約書関連通知: 送付先メールアドレス</li>
        </ul>
        <p className="text-[11px] text-blue-900/80">
          ※ いずれの変数も、値が取得できなかった場合は「(データの取得に失敗しました)」という文字列に置き換わります。
        </p>

        <details className="group mt-1">
          <summary className="flex items-center gap-1 cursor-pointer text-xs font-medium text-blue-900 hover:underline select-none">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            各変数の中身・取得ルートの詳細を見る
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed bg-white/70 rounded-md border border-blue-200 p-3">
            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{companyName}}"} — 事業者名
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 事業者名簿ページ → 該当事業者 → 「事業者名」欄</li>
                <li>表示例: 株式会社サンプル</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{scheduledAt}}"} — 商談日時
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 事業者名簿ページ → 該当事業者の「商談」タブ → 該当商談カードの「案内日 / 商談日」</li>
                <li>表示例: 2026/04/25(金) 14:00（曜日付き、JSTで整形）</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{staffName}}"} — 担当者名
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 事業者詳細の「商談」タブ → 「担当者」プルダウンで選んだスタッフが、プロライン担当者ページに登録されている場合の「プロライン担当者名」</li>
                <li>取得ロジック（フォールバック3段階）:
                  <ol className="list-decimal pl-5 space-y-0.5 mt-0.5">
                    <li>プロラインからの予約データに記録されている担当者名（プロラインWebhookで送られてきた生テキスト）</li>
                    <li>①が空（手動セットなど） → スタッフ管理の「氏名」</li>
                    <li>どちらも取得できなければ「(データの取得に失敗しました)」</li>
                  </ol>
                </li>
                <li>表示例: 田中</li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{zoomUrl}}"} — Zoom URL
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 事業者名簿ページ → 該当事業者の「商談」タブ → 該当商談に紐づく Zoom会議のURL（「Zoomを発行する」ボタンで作られるURL（Zoom側の参加用URL））</li>
                <li>取得ロジック: セッション → 接触履歴（最も古いもの） → Zoom録画（isPrimary=true、最新）</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code>（Zoom未発行・キャンセル済み・既に削除されたセッションなど）</li>
                <li>⚠️ 1つの商談に追加で発行された延長Zoomは入りません（メインのみ）</li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{referrerName}}"} — 紹介者名
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>どこから？ 紹介者本人の、公式LINEに登録されている表示名（SNS表示名）</li>
                <li>画面で言うと: 事業者詳細のメイン担当者のLINE友達情報の「紹介者UID（free1欄）」が指している人のLINE表示名。または商談モーダルで「紹介者通知」にチェックを入れた紹介者本人のLINE表示名。</li>
                <li>取得ロジック（送信ルートに関わらず「紹介者本人のLINE表示名」で統一）:
                  <ol className="list-decimal pl-5 space-y-0.5 mt-0.5">
                    <li>手動セット / 予約中昇格 / 飛び モーダルから送信 → チェックを入れた紹介者のLINE SNS表示名</li>
                    <li>プロラインWebhook等の自動送信 → メイン担当者のLINE友達情報の「紹介者UID（free1欄）」が指す紹介者本人のLINE SNS表示名</li>
                  </ol>
                </li>
                <li>表示例: 田中太郎</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code>（紹介者UIDが未設定・解決できない場合）</li>
              </ul>
            </div>

            <div className="border-t border-blue-200 pt-2">
              <div className="font-semibold text-blue-900 mb-1">
                {"{{addedFriendLineName}}"} — 友達追加通知（紹介ライフサイクル）
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>どこから？ 公式LINEを新しく友達追加した本人のLINE SNS表示名</li>
                <li>発火タイミング: LINE友だち追加webhookが来て、追加した人の <code>free1</code> に紹介者UIDが入っているときのみ、その紹介者に送信</li>
                <li>表示例: 山田花子</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
                <li>⚠️ 友達追加通知テンプレでのみ使用。他テンプレではこの変数を書かないでください（常に「(データの取得に失敗しました)」になります）</li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{memberName}}"} — 契約締結通知: 組合員の氏名
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 組合員名簿ページ → 該当組合員 → 「氏名」欄</li>
                <li>発火タイミング: CloudSignで契約書締結完了 or LINE後紐付け成立 のとき、組合員の <code>free1</code> にある紹介者UIDに送信</li>
                <li>表示例: 田中太郎</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{memberLineName}}"} — 契約締結通知: 組合員のLINE名
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 組合員名簿ページ → 該当組合員 → 「LINE名」欄（公式LINEで表示される名前）</li>
                <li>表示例: たなか</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
              </ul>
            </div>

            <div className="border-t border-blue-200 pt-2">
              <div className="font-semibold text-blue-900 mb-1">
                {"{{contractSentDate}}"} — 契約書リマインド: 送付日
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 組合員名簿ページ → 該当組合員 → 「契約書送付日」</li>
                <li>表示例: 2026年4月1日（日本語形式）</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
                <li>⚠️ 契約書リマインドテンプレでのみ使用。メール不達通知では値が入らないので書かないでください</li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-blue-900 mb-1">
                {"{{contractSentEmail}}"} — 契約書関連通知: 送付先メールアドレス
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li>画面で言うと: 組合員名簿ページ → 該当組合員 → 「メールアドレス」（クラウドサイン送付先）</li>
                <li>バウンス通知では、実際に不達になったメールアドレスが入ります</li>
                <li>表示例: tanaka@example.com</li>
                <li>空のとき: <code className="bg-neutral-100 px-1 rounded">(データの取得に失敗しました)</code></li>
              </ul>
            </div>

            <div className="border-t border-blue-200 pt-2">
              <div className="font-semibold text-blue-900 mb-1">補足: 通知の送信先（変数とは別）</div>
              <ul className="list-disc pl-5 space-y-0.5 text-neutral-700">
                <li><strong>お客様向け</strong>: 事業者の「担当者」タブで「商談通知を受け取る」ONの人、および各商談を予約した本人（必ず通知）。商談ごとに「通知対象を個別設定」でその商談だけ対象を変更可能。</li>
                <li><strong>紹介者向け（商談まわり）</strong>: 事業者のメイン担当者のLINE友達情報の <code>free1</code>欄（紹介者UID）、または手動モーダルでチェックした紹介者のLINE UID。</li>
                <li><strong>紹介者向け（紹介ライフサイクル）</strong>: 友達追加通知は「追加された人の <code>free1</code>」、契約締結通知は「組合員の <code>free1</code>」に入っている紹介者UIDに直接送信。</li>
                <li><strong>組合員向け（契約書関連）</strong>: 組合員本人のLINE UIDに直接送信（契約書リマインドは cron 自動発火、メール不達通知は CloudSign webhook 起点）。</li>
                <li>必要なLINE紐付けが欠けていると「LINE UIDが取得できません」エラーで送信されません。</li>
              </ul>
            </div>
          </div>
        </details>
      </div>

      <Tabs defaultValue="customer_briefing" className="w-full">
        <TabsList>
          <TabsTrigger value="customer_briefing">
            お客様 / 概要案内 ({tabs.customerBriefing.length})
          </TabsTrigger>
          <TabsTrigger value="customer_consultation">
            お客様 / 導入希望商談 ({tabs.customerConsultation.length})
          </TabsTrigger>
          <TabsTrigger value="referrer">
            紹介者向け ({tabs.referrerTotal})
          </TabsTrigger>
          <TabsTrigger value="member">
            組合員向け ({tabs.memberTotal})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customer_briefing" className="pt-4">
          {renderGrouped(tabs.customerBriefing)}
        </TabsContent>
        <TabsContent value="customer_consultation" className="pt-4">
          {renderGrouped(tabs.customerConsultation)}
        </TabsContent>
        <TabsContent value="referrer" className="pt-4 space-y-6">
          {/* 商談まわり */}
          <section className="space-y-2">
            <div className="flex items-baseline gap-2 pb-1 border-b">
              <h3 className="font-semibold text-sm">商談まわり</h3>
              <span className="text-xs text-muted-foreground">
                ({tabs.referrerBriefing.length}件・商談の予約確定/変更/キャンセル/完了/不参加を紹介者に通知)
              </span>
            </div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              紹介者通知は概要案内1回目のみ送信されます（手動セット時は「紹介者にも通知を送信する」チェックON時のみ）。
            </Label>
            {renderGrouped(tabs.referrerBriefing)}
          </section>

          {/* 紹介ライフサイクル */}
          <section className="space-y-2">
            <div className="flex items-baseline gap-2 pb-1 border-b">
              <h3 className="font-semibold text-sm">紹介ライフサイクル</h3>
              <span className="text-xs text-muted-foreground">
                ({tabs.referrerReferral.length}件・友達追加/契約締結のタイミングで紹介者に通知)
              </span>
            </div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              友達追加通知は新しく公式LINEが追加された時（追加した人の <code>free1</code> にある紹介者宛）、
              契約締結通知は組合員契約完了時（組合員の <code>free1</code> にある紹介者宛）に自動送信されます。
            </Label>
            {renderGrouped(tabs.referrerReferral)}
          </section>
        </TabsContent>

        <TabsContent value="member" className="pt-4 space-y-6">
          {/* 契約書関連 */}
          <section className="space-y-2">
            <div className="flex items-baseline gap-2 pb-1 border-b">
              <h3 className="font-semibold text-sm">契約書関連</h3>
              <span className="text-xs text-muted-foreground">
                ({tabs.memberContract.length}件・組合員本人へのリマインド/メール不達通知)
              </span>
            </div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              契約書リマインドは cron（毎日10時）で送付後 reminderDays 日経過した未締結メンバーに自動送信、
              メール不達通知は CloudSign バウンス検知時に自動送信されます。手動リマインドも
              組合員名簿のリマインドボタンから同じテンプレで送られます。
            </Label>
            {renderGrouped(tabs.memberContract)}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
