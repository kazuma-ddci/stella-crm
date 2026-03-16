"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  ChatMessage,
  InsightCategory,
  InsightItem,
  InsightResult,
} from "../types";
import { INSIGHT_CATEGORIES, getItemsByCategory } from "../insight-definitions";
import { getInsightData } from "../actions";
import { CategoryGrid, ItemGrid, MonthParamSelector, NavigationButtons } from "./category-selector";
import { ResultDisplay } from "./result-display";

// ============================================
// クライアント用ユーティリティ（サーバーモジュール依存を避けるためインライン化）
// ============================================

function generateCommentary(result: InsightResult): string {
  const comments: string[] = [];
  switch (result.type) {
    case "number": {
      if (result.comparison) {
        const { changePercent } = result.comparison;
        if (changePercent > 20) comments.push("大幅な伸びが見られます。この勢いを維持しましょう。");
        else if (changePercent > 5) comments.push("前月からの改善傾向が確認できます。");
        else if (changePercent > -5) comments.push("前月とほぼ同水準で推移しています。");
        else if (changePercent > -20) comments.push("やや減少傾向にあります。原因の分析を推奨します。");
        else comments.push("大きな減少が見られます。早急な対応を検討してください。");
      }
      if (result.format === "days" && result.value > 60) comments.push("期間が長めです。プロセスの見直しを検討してもよいかもしれません。");
      if (result.format === "percent" && result.value > 80) comments.push("高い水準を維持しています。");
      break;
    }
    case "breakdown": {
      if (result.items.length > 0) {
        const top = result.items[0];
        if (top.percent > 70) comments.push(`${top.label}が全体の${top.percent}%を占めています。集中度が高い状態です。`);
        else if (result.items.length >= 3) comments.push("バランスの取れた構成になっています。");
      }
      break;
    }
    case "table": {
      if (result.rows.length === 0) comments.push("現時点で該当するデータはありません。良好な状態と言えます。");
      else if (result.rows.length > 10) comments.push(`${result.rows.length}件のデータがあります。優先度の高いものから確認していきましょう。`);
      else comments.push(`${result.rows.length}件のデータを取得しました。`);
      break;
    }
    case "ranking": {
      if (result.items.length > 0) {
        comments.push(`トップは「${result.items[0].name}」です。`);
        if (result.items.length >= 2 && result.items[0].value > result.items[1].value * 2) {
          comments.push("1位と2位の差が大きく、突出したパフォーマンスです。");
        }
      } else comments.push("現時点で該当するデータはありません。");
      break;
    }
    case "trend": {
      const values = result.months.filter((m) => m.value !== null).map((m) => m.value!);
      if (values.length >= 3) {
        const r = values.slice(-3);
        if (r[2] > r[1] && r[1] > r[0]) comments.push("直近3ヶ月は上昇トレンドにあります。");
        else if (r[2] < r[1] && r[1] < r[0]) comments.push("直近3ヶ月は下降トレンドです。要因の分析を推奨します。");
        else comments.push("直近の推移に一定の変動が見られます。");
      }
      break;
    }
    case "summary": {
      const pc = result.cards.find((c) => c.format === "percent");
      if (pc) {
        if (pc.value >= 100) comments.push("目標を達成しています。素晴らしい成果です。");
        else if (pc.value >= 80) comments.push("目標達成まであと少しです。ラストスパートを期待します。");
        else if (pc.value >= 50) comments.push("目標の半分を超えています。ペースアップが必要です。");
        else comments.push("目標に対してまだ開きがあります。戦略の見直しを検討してください。");
      }
      if (result.details && result.details.length > 0) comments.push(`詳細データとして${result.details.length}件の内訳を表示しています。`);
      break;
    }
  }
  const closings = [
    "他に確認したいデータがあればお選びください。",
    "さらに深掘りしたい項目があればお気軽にどうぞ。",
    "別の角度からの分析も可能です。",
    "関連する他の指標も合わせてご確認ください。",
  ];
  comments.push(closings[Math.floor(Math.random() * closings.length)]);
  return comments.join(" ");
}

function getLoadingSteps(insightId: string): string[] {
  const prefix = insightId.split("_")[0];
  const baseSteps = ["データベースに接続しています..."];
  const categorySteps: Record<string, string[]> = {
    revenue: ["売上レコードを取得中...", "契約データと照合しています...", "前月比を計算中...", "分析結果を生成しています..."],
    gross: ["売上データを集計中...", "固定費情報を取得中...", "粗利を算出しています...", "レポートを作成中..."],
    receivables: ["請求データを検索中...", "未入金レコードを抽出中...", "支払期限を確認中...", "結果を整理しています..."],
    overdue: ["請求書データを取得中...", "支払期限を検証中...", "遅延リストを生成しています..."],
    sales: ["パイプラインデータを取得中...", "ステージ別集計を実行中...", "分析結果をまとめています..."],
    new: ["リード獲得データを検索中...", "月別集計を実行中...", "前月との比較を計算中..."],
    conversion: ["全商談データを分析中...", "受注履歴を集計中...", "転換率を算出しています..."],
    pipeline: ["企業データを取得中...", "担当者別に振り分け中...", "集計結果を整理しています..."],
    avg: ["履歴データを分析中...", "期間計算を実行中...", "統計値を算出しています..."],
    won: ["受注履歴を検索中...", "契約情報を取得中...", "金額を集計しています..."],
    progressed: ["ステージ変更履歴を検索中...", "前進イベントを抽出中...", "リストを生成中..."],
    stale: ["全案件のステージ滞在期間を計算中...", "閾値を超える案件を抽出中...", "結果をソート中..."],
    lost: ["失注データを集計中...", "失注理由を分析中...", "レポートを作成しています..."],
    top: ["履歴データを全件スキャン中...", "理由をカテゴリ分類中...", "ランキングを生成中..."],
    pending: ["検討中ステータスの案件を検索中...", "担当者情報を取得中...", "リストを整理中..."],
    revived: ["復活イベントを検索中...", "遷移履歴を確認中...", "結果をまとめています..."],
    active: ["契約データを検索中...", "有効期間を検証中...", "集計結果をまとめています..."],
    customer: ["顧客別売上を計算中...", "日割按分を適用中...", "ランキングを生成しています..."],
    expiring: ["契約終了日を検索中...", "残日数を計算中...", "リストを生成中..."],
    contract: ["契約書データを取得中...", "プラン別に集計中...", "分析結果を整理中..."],
    industry: ["業種データを分析中...", "分布を計算中...", "結果を生成しています..."],
    agent: ["代理店データを取得中...", "実績を集計中...", "ランキングを生成しています..."],
    unsigned: ["契約書ステータスを確認中...", "未締結リストを抽出中...", "結果を整理中..."],
    cloudsign: ["CloudSign連携状況を確認中...", "送付中ドキュメントを検索中...", "リストを生成中..."],
    signed: ["締結履歴を検索中...", "該当期間のデータを抽出中...", "結果をまとめています..."],
    monthly: ["月次経費データを取得中...", "前月との比較を計算中...", "レポートを生成中..."],
    expense: ["経費レコードを分類中...", "種別ごとの金額を集計中...", "内訳を整理中..."],
    unpaid: ["支払いステータスを確認中...", "未払いレコードを抽出中...", "リストを生成中..."],
    contact: ["接触履歴を検索中...", "件数を集計中...", "分析結果を生成しています..."],
    inactive: ["全顧客の最終接触日を計算中...", "未接触期間を検証中...", "リストを生成中..."],
    kpi: ["KPI目標値を取得中...", "実績データを集計中...", "達成率を計算しています..."],
    candidate: ["候補者データを取得中...", "入社記録を集計中...", "結果をまとめています..."],
  };
  return [...baseSteps, ...(categorySteps[prefix] ?? ["データを分析中...", "集計処理を実行中...", "結果を生成しています..."])];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// タイプライターコンポーネント
// ============================================

function TypeWriter({
  text,
  speed = 20,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(timer);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-4 bg-gray-500 animate-pulse ml-0.5 align-middle" />}
    </span>
  );
}

// ============================================
// プログレッシブローディング
// ============================================

function ProgressiveLoading({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-md">
        AI
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => {
          if (i > currentStep) return null;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                isActive ? "text-gray-700" : "text-gray-400"
              }`}
            >
              {isDone ? (
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              )}
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// メインチャットコンテナ
// ============================================

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<string[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingItemRef = useRef<InsightItem | null>(null);
  const initializedRef = useRef(false);

  // 初回ウェルカムメッセージ（タイプライターで）
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const timer = setTimeout(() => {
      setMessages([
        {
          id: generateId(),
          role: "system",
          content: "こんにちは！経営データの分析アシスタントです。確認したいデータのカテゴリを選択してください。",
          categories: INSIGHT_CATEGORIES,
        },
      ]);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loadingStep]);

  const addMessages = useCallback((...msgs: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
  }, []);

  // カテゴリ選択 → AIが応答する演出
  const handleSelectCategory = useCallback(async (category: InsightCategory) => {
    setSelectedCategory(category);
    // ユーザーメッセージを先に表示
    addMessages({ id: generateId(), role: "user", content: category.name });

    // 少し待ってからAI応答（考えている感）
    await sleep(400 + Math.random() * 300);

    const items = getItemsByCategory(category.id);
    const responses = [
      `${category.name}ですね。以下の項目から確認したい情報を選んでください。`,
      `${category.name}に関するデータを用意しています。どの項目を確認しますか？`,
      `承知しました。${category.name}についてお調べします。どの情報が必要ですか？`,
      `${category.name}の分析メニューです。気になる項目をお選びください。`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    addMessages({
      id: generateId(),
      role: "system",
      content: response,
      items,
    });
  }, [addMessages]);

  // データ取得（プログレッシブローディング演出付き）
  const fetchData = useCallback(async (insightId: string, params: Record<string, string | number>) => {
    setIsLoading(true);
    const steps = getLoadingSteps(insightId);
    setLoadingSteps(steps);
    setLoadingStep(0);

    // ステップを段階的に進めるタイマー
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 600 + Math.random() * 400);

    try {
      // データ取得（APIコールと並行してアニメーション）
      const [result] = await Promise.all([
        getInsightData(insightId, params),
        sleep(steps.length * 500), // 最低限のローディング時間を確保
      ]);

      clearInterval(stepInterval);
      // 全ステップ完了を見せる
      setLoadingStep(steps.length - 1);
      await sleep(400);

      const commentary = generateCommentary(result);

      setIsLoading(false);
      setLoadingSteps([]);
      setLoadingStep(0);

      addMessages({
        id: generateId(),
        role: "result",
        result,
        commentary,
      });
    } catch {
      clearInterval(stepInterval);
      setIsLoading(false);
      setLoadingSteps([]);
      setLoadingStep(0);

      addMessages({
        id: generateId(),
        role: "system",
        content: "申し訳ございません。データの取得中にエラーが発生しました。もう一度お試しください。",
      });
    }
  }, [addMessages]);

  // アイテム選択
  const handleSelectItem = useCallback(async (item: InsightItem) => {
    if (item.params && item.params.length > 0) {
      addMessages({ id: generateId(), role: "user", content: item.name });
      await sleep(300 + Math.random() * 200);
      const prompts = [
        "分析する対象月を選んでください。",
        "どの月のデータを確認しますか？",
        "対象期間をお選びください。",
      ];
      addMessages({
        id: generateId(),
        role: "system",
        content: prompts[Math.floor(Math.random() * prompts.length)],
        params: item.params,
      });
      pendingItemRef.current = item;
    } else {
      addMessages({ id: generateId(), role: "user", content: item.name });
      fetchData(item.id, {});
    }
  }, [addMessages, fetchData]);

  // パラメータ送信
  const handleParamSubmit = useCallback((values: Record<string, string | number>) => {
    const item = pendingItemRef.current;
    if (!item) return;
    pendingItemRef.current = null;

    const paramLabel = values.yearMonth
      ? `${values.yearMonth}`
      : Object.values(values).join(", ");
    if (paramLabel) {
      addMessages({ id: generateId(), role: "user", content: paramLabel });
    }
    fetchData(item.id, values);
  }, [addMessages, fetchData]);

  // ナビゲーション
  const handleBackToCategories = useCallback(async () => {
    setSelectedCategory(null);
    pendingItemRef.current = null;
    addMessages({ id: generateId(), role: "user", content: "最初に戻る" });
    await sleep(300);
    const responses = [
      "かしこまりました。他に確認したいデータはありますか？",
      "了解です。別のカテゴリをお選びください。",
      "承知しました。他のデータも確認してみましょう。",
    ];
    addMessages({
      id: generateId(),
      role: "system",
      content: responses[Math.floor(Math.random() * responses.length)],
      categories: INSIGHT_CATEGORIES,
    });
  }, [addMessages]);

  const handleBackToItems = useCallback(async () => {
    if (!selectedCategory) return;
    pendingItemRef.current = null;
    addMessages({ id: generateId(), role: "user", content: `${selectedCategory.name}の別の項目を見る` });
    await sleep(300);
    const items = getItemsByCategory(selectedCategory.id);
    addMessages({
      id: generateId(),
      role: "system",
      content: `${selectedCategory.name}の他の項目はこちらです。`,
      items,
    });
  }, [selectedCategory, addMessages]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* ヘッダー */}
      <div className="shrink-0 border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white">
            AI
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">経営インサイト</h1>
            <p className="text-[11px] text-gray-400">AI分析アシスタント</p>
          </div>
        </div>
      </div>

      {/* メッセージエリア */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectCategory={handleSelectCategory}
              onSelectItem={handleSelectItem}
              onParamSubmit={handleParamSubmit}
              onBackToCategories={handleBackToCategories}
              onBackToItems={handleBackToItems}
              selectedCategory={selectedCategory}
              defaultMonth={getCurrentYearMonth()}
              isLoading={isLoading}
            />
          ))}
          {/* プログレッシブローディング */}
          {isLoading && loadingSteps.length > 0 && (
            <ProgressiveLoading steps={loadingSteps} currentStep={loadingStep} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// メッセージバブル
// ============================================

function MessageBubble({
  message,
  onSelectCategory,
  onSelectItem,
  onParamSubmit,
  onBackToCategories,
  onBackToItems,
  selectedCategory,
  defaultMonth,
  isLoading,
}: {
  message: ChatMessage;
  onSelectCategory: (cat: InsightCategory) => void;
  onSelectItem: (item: InsightItem) => void;
  onParamSubmit: (values: Record<string, string | number>) => void;
  onBackToCategories: () => void;
  onBackToItems: () => void;
  selectedCategory: InsightCategory | null;
  defaultMonth: string;
  isLoading: boolean;
}) {
  // loading はProgressiveLoadingに移行したので不要
  if (message.role === "loading") return null;

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-500 px-4 py-2.5 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "result") {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-md">
          AI
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {/* AIコメンタリー */}
          <div className="text-sm text-gray-700">
            <TypeWriter text={message.commentary} speed={15} />
          </div>
          {/* 結果表示 */}
          <ResultDisplay result={message.result} />
          {/* ナビゲーション */}
          {!isLoading && (
            <NavigationButtons
              onBackToCategories={onBackToCategories}
              onBackToItems={selectedCategory ? onBackToItems : undefined}
              categoryName={selectedCategory?.name}
            />
          )}
        </div>
      </div>
    );
  }

  // system message
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-md">
        AI
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="text-sm text-gray-700">
          <TypeWriter text={message.content} speed={18} />
        </div>
        {message.categories && (
          <CategoryGrid
            categories={message.categories}
            onSelect={onSelectCategory}
            disabled={isLoading}
          />
        )}
        {message.items && (
          <ItemGrid items={message.items} onSelect={onSelectItem} disabled={isLoading} />
        )}
        {message.params && (
          <MonthParamSelector
            params={message.params}
            defaultMonth={defaultMonth}
            onSubmit={onParamSubmit}
          />
        )}
      </div>
    </div>
  );
}
