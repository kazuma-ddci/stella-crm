// ステージ遷移ロジックの定数

import { AlertId, AlertSeverity, StageEventType } from './types';

// イベントラベルとアイコン
export const EVENT_LABELS: Record<StageEventType, { label: string; icon: string }> = {
  commit: { label: '目標設定', icon: '🎯' },
  achieved: { label: '目標達成', icon: '🎉' },
  recommit: { label: '目標変更', icon: '🔄' },
  progress: { label: '前進', icon: '📈' },
  back: { label: '後退', icon: '📉' },
  cancel: { label: '目標取消', icon: '❌' },
  won: { label: '受注', icon: '🎊' },
  lost: { label: '失注', icon: '💔' },
  suspended: { label: '検討中', icon: '⏸️' },
  resumed: { label: '再開', icon: '▶️' },
  revived: { label: '復活', icon: '🔄' },
  reason_updated: { label: '理由更新', icon: '📝' },
};

// recommitのサブタイプラベル
export const RECOMMIT_SUBTYPE_LABELS: Record<string, string> = {
  positive: '前向き',
  negative: '後ろ向き',
  neutral: '',
};

// 統計から除外するイベント種別
export const EXCLUDED_FROM_STATS: StageEventType[] = ['reason_updated'];

// アラートの定義
export interface AlertDefinition {
  id: AlertId;
  severity: AlertSeverity;
  message: string;
  requiresNote?: boolean;
}

// 終了ステージ（受注=5, 失注=6）
export const TERMINAL_STAGE_IDS = {
  WON: 5,      // 受注
  LOST: 6,     // 失注
  PENDING: 7,  // 検討中
};

// 目標に設定できないステージID（検討中のみ）
// 失注はWARNINGで確認後設定可能に変更
export const NON_TARGET_STAGE_IDS = [
  TERMINAL_STAGE_IDS.PENDING,  // 検討中
];

// 失注は確認後に目標に設定可能
export const CONFIRM_TARGET_STAGE_IDS = [
  TERMINAL_STAGE_IDS.LOST,     // 失注
];

// アラートメッセージ定義
export const ALERT_DEFINITIONS: Record<AlertId, AlertDefinition> = {
  // カテゴリ1：論理的に矛盾している操作
  'L-001': {
    id: 'L-001',
    severity: 'ERROR',
    message: '現在のステージより前のステージを目標に設定することはできません。現在のステージを先に後退させてから、目標を設定してください。',
  },
  'L-002': {
    id: 'L-002',
    severity: 'ERROR',
    message: '現在のステージと同じステージを目標に設定することはできません。',
  },
  'L-004': {
    id: 'L-004',
    severity: 'ERROR',
    message: '目標ステージを設定せずに目標日だけを設定することはできません。',
  },
  'L-005': {
    id: 'L-005',
    severity: 'WARNING',
    message: '失注が目標になっています。よろしいですか？',
  },
  'L-006': {
    id: 'L-006',
    severity: 'ERROR',
    message: '検討中は目標として設定できません。',
  },

  // カテゴリ2：時系列的におかしい操作
  'T-001': {
    id: 'T-001',
    severity: 'ERROR',
    message: '過去の日付を目標日に設定することはできません。',
  },
  'T-002': {
    id: 'T-002',
    severity: 'WARNING',
    message: '目標日が1年以上先に設定されています。この日付で間違いありませんか？',
  },
  'T-003': {
    id: 'T-003',
    severity: 'INFO',
    message: '本日が目標日ですがよろしいですか？',
  },

  // カテゴリ3：ステージ遷移としておかしい操作
  'S-001': {
    id: 'S-001',
    severity: 'WARNING',
    message: 'ステージが3段階以上飛んでいます。途中のステージをスキップしますか？',
  },
  'S-002': {
    id: 'S-002',
    severity: 'WARNING',
    message: '受注済みの案件を変更しようとしています。変更理由を入力してください。',
    requiresNote: true,
  },
  'S-003': {
    id: 'S-003',
    severity: 'WARNING',
    message: '失注した案件が復活します。変更理由を入力してください。',
    requiresNote: true,
  },
  'S-005': {
    id: 'S-005',
    severity: 'WARNING',
    message: '失注から検討中に変更します。再検討になった理由をメモに記載してください。',
    requiresNote: true,
  },
  'S-006': {
    id: 'S-006',
    severity: 'INFO',
    message: '目標ステージを現在のステージが追い越します。目標達成として記録してよろしいですか？違う場合は、修正するか、メモに状態を記載してください。',
  },
  'S-007': {
    id: 'S-007',
    severity: 'WARNING',
    message: '後退により、目標が現在のステージより前になります。目標を修正しますか？',
  },

  // カテゴリ4：目標管理としておかしい操作
  'G-001': {
    id: 'G-001',
    severity: 'WARNING',
    message: '目標を達成する前に削除しようとしています。理由を入力してください。',
    requiresNote: true,
  },
  'G-002': {
    id: 'G-002',
    severity: 'INFO',
    message: '直近1週間で目標が複数回変更されています。',
  },
  'G-003': {
    id: 'G-003',
    severity: 'WARNING',
    message: '目標の達成日が3回以上延期されています。',
  },
  'G-004': {
    id: 'G-004',
    severity: 'INFO',
    message: '目標日が大幅に前倒しされました。',
  },
  'G-005': {
    id: 'G-005',
    severity: 'ERROR',
    message: '今到達したステージを次の目標に設定することはできません。',
  },

  // カテゴリ5：データ整合性の問題
  'D-001': {
    id: 'D-001',
    severity: 'ERROR',
    message: '現在のステージは必須です。',
  },
  'D-003': {
    id: 'D-003',
    severity: 'ERROR',
    message: '目標ステージがないため、目標日を削除してください。',
  },
  'D-004': {
    id: 'D-004',
    severity: 'WARNING',
    message: 'ステージが後退しています。理由を入力してください。',
    requiresNote: true,
  },
};

// 深刻度の優先順位
export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
};

// アラートの色
export const ALERT_COLORS: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  ERROR: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: '⛔',
  },
  WARNING: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: '⚠️',
  },
  INFO: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'ℹ️',
  },
};
