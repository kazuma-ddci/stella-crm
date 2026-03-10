// 契約書ステータス管理の定数

import { ContractStatusAlertId, AlertSeverity, ContractStatusEventType, ContractStatusInfo, ContractStatusType } from './types';

// イベントラベルとアイコン
export const CONTRACT_STATUS_EVENT_LABELS: Record<ContractStatusEventType, { label: string; icon: string }> = {
  created: { label: '新規作成', icon: '📝' },
  progress: { label: '前進', icon: '📈' },
  back: { label: '後退', icon: '📉' },
  signed: { label: '締結', icon: '✅' },
  discarded: { label: '破棄', icon: '🗑️' },
  revived: { label: '復活', icon: '🔄' },
  reopened: { label: '再開', icon: '▶️' },
  suspended: { label: '保留', icon: '⏸️' },
  resumed: { label: '保留解除', icon: '▶️' },
};

// statusType ベースのヘルパー関数
export function isSignedStatus(s: { statusType: ContractStatusType }): boolean {
  return s.statusType === 'signed';
}

export function isDiscardedStatus(s: { statusType: ContractStatusType }): boolean {
  return s.statusType === 'discarded';
}

export function isTerminalStatus(s: { statusType: ContractStatusType }): boolean {
  return s.statusType !== 'progress' && s.statusType !== 'pending';
}

export function isPendingStatus(s: { statusType: ContractStatusType }): boolean {
  return s.statusType === 'pending';
}

export function isProgressStatus(s: { statusType: ContractStatusType }): boolean {
  return s.statusType === 'progress';
}

// 進行中ステータスの数を動的に取得
export function getProgressStatusCount(statuses: ContractStatusInfo[]): number {
  return statuses.filter((s) => s.statusType === 'progress').length;
}

// 滞留アラートの日数閾値
export const STALE_ALERT_DAYS = 3;

// 滞留チェック対象のCloudSignマッピング値（送付済み = "created"）
export const STALE_CHECK_CLOUDSIGN_MAPPING = 'created';

// アラート定義
export interface ContractStatusAlertDefinition {
  id: ContractStatusAlertId;
  severity: AlertSeverity;
  message: string;
  requiresNote?: boolean;
}

// アラートメッセージ定義
export const CONTRACT_STATUS_ALERT_DEFINITIONS: Record<ContractStatusAlertId, ContractStatusAlertDefinition> = {
  'STALE-001': {
    id: 'STALE-001',
    severity: 'WARNING',
    message: '送付済みのまま3日以上経過しています。先方に確認してください。',
  },
  'TRANS-001': {
    id: 'TRANS-001',
    severity: 'WARNING',
    message: '破棄された契約書を復活させます。理由を入力してください。',
    requiresNote: true,
  },
  'TRANS-002': {
    id: 'TRANS-002',
    severity: 'WARNING',
    message: '締結済みの契約書を再開します。理由を入力してください。',
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

// ステータスの背景色
export const STATUS_COLORS: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  current: 'bg-blue-500 text-white',
  completed: 'bg-green-500 text-white',
  terminal_signed: 'bg-green-600 text-white',
  terminal_discarded: 'bg-red-500 text-white',
  pending: 'bg-orange-100 text-orange-700',
};
