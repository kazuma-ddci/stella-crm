import type { InsightResult } from "./types";

/** 結果データからAI風のコメントを生成 */
export function generateCommentary(result: InsightResult): string {
  const comments: string[] = [];

  switch (result.type) {
    case "number": {
      if (result.comparison) {
        const { changePercent } = result.comparison;
        if (changePercent > 20) {
          comments.push("大幅な伸びが見られます。この勢いを維持しましょう。");
        } else if (changePercent > 5) {
          comments.push("前月からの改善傾向が確認できます。");
        } else if (changePercent > -5) {
          comments.push("前月とほぼ同水準で推移しています。");
        } else if (changePercent > -20) {
          comments.push("やや減少傾向にあります。原因の分析を推奨します。");
        } else {
          comments.push("大きな減少が見られます。早急な対応を検討してください。");
        }
      }
      if (result.format === "days" && result.value > 60) {
        comments.push("期間が長めです。プロセスの見直しを検討してもよいかもしれません。");
      }
      if (result.format === "percent" && result.value > 80) {
        comments.push("高い水準を維持しています。");
      }
      break;
    }
    case "breakdown": {
      if (result.items.length > 0) {
        const top = result.items[0];
        if (top.percent > 70) {
          comments.push(`${top.label}が全体の${top.percent}%を占めています。集中度が高い状態です。`);
        } else if (result.items.length >= 3) {
          comments.push("バランスの取れた構成になっています。");
        }
      }
      break;
    }
    case "table": {
      if (result.rows.length === 0) {
        comments.push("現時点で該当するデータはありません。良好な状態と言えます。");
      } else if (result.rows.length > 10) {
        comments.push(`${result.rows.length}件のデータがあります。優先度の高いものから確認していきましょう。`);
      } else {
        comments.push(`${result.rows.length}件のデータを取得しました。`);
      }
      break;
    }
    case "ranking": {
      if (result.items.length > 0) {
        comments.push(`トップは「${result.items[0].name}」です。`);
        if (result.items.length >= 2) {
          const topValue = result.items[0].value;
          const secondValue = result.items[1].value;
          if (topValue > secondValue * 2) {
            comments.push("1位と2位の差が大きく、突出したパフォーマンスです。");
          }
        }
      } else {
        comments.push("現時点で該当するデータはありません。");
      }
      break;
    }
    case "trend": {
      const values = result.months.filter((m) => m.value !== null).map((m) => m.value!);
      if (values.length >= 3) {
        const recent3 = values.slice(-3);
        const isUptrend = recent3[2] > recent3[1] && recent3[1] > recent3[0];
        const isDowntrend = recent3[2] < recent3[1] && recent3[1] < recent3[0];
        if (isUptrend) {
          comments.push("直近3ヶ月は上昇トレンドにあります。");
        } else if (isDowntrend) {
          comments.push("直近3ヶ月は下降トレンドです。要因の分析を推奨します。");
        } else {
          comments.push("直近の推移に一定の変動が見られます。");
        }
      }
      break;
    }
    case "summary": {
      const percentCard = result.cards.find((c) => c.format === "percent");
      if (percentCard) {
        if (percentCard.value >= 100) {
          comments.push("目標を達成しています。素晴らしい成果です。");
        } else if (percentCard.value >= 80) {
          comments.push("目標達成まであと少しです。ラストスパートを期待します。");
        } else if (percentCard.value >= 50) {
          comments.push("目標の半分を超えています。ペースアップが必要です。");
        } else {
          comments.push("目標に対してまだ開きがあります。戦略の見直しを検討してください。");
        }
      }
      if (result.details && result.details.length > 0) {
        comments.push(`詳細データとして${result.details.length}件の内訳を表示しています。`);
      }
      break;
    }
  }

  // ランダムな締めフレーズ
  const closings = [
    "他に確認したいデータがあればお選びください。",
    "さらに深掘りしたい項目があればお気軽にどうぞ。",
    "別の角度からの分析も可能です。",
    "関連する他の指標も合わせてご確認ください。",
  ];
  comments.push(closings[Math.floor(Math.random() * closings.length)]);

  return comments.join(" ");
}

/** カテゴリに応じたローディングステップを返す */
export function getLoadingSteps(insightId: string): string[] {
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

  const matchedSteps = categorySteps[prefix] ?? ["データを分析中...", "集計処理を実行中...", "結果を生成しています..."];

  return [...baseSteps, ...matchedSteps];
}
