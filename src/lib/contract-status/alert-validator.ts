// 契約書ステータスのアラート検証ロジック

import {
  ContractStatusChangeInput,
  ContractStatusInfo,
  ContractStatusValidationResult,
  ContractStatusAlert,
  ContractStatusHistoryRecord,
} from './types';
import {
  CONTRACT_STATUS_ALERT_DEFINITIONS,
  TERMINAL_STATUS_IDS,
  SENT_STATUS_ID,
  STALE_ALERT_DAYS,
  SEVERITY_ORDER,
} from './constants';

/**
 * ステータス変更のバリデーションを実行
 */
export function validateContractStatusChange(
  input: ContractStatusChangeInput,
  statuses: ContractStatusInfo[],
  lastHistory?: ContractStatusHistoryRecord | null
): ContractStatusValidationResult {
  const alerts: ContractStatusAlert[] = [];

  const getStatus = (id: number | null): ContractStatusInfo | null => {
    if (id === null) return null;
    return statuses.find((s) => s.id === id) ?? null;
  };

  const currentStatus = getStatus(input.currentStatusId);
  const newStatus = getStatus(input.newStatusId);

  // ステータスが変更されていない場合はアラートなし
  if (input.currentStatusId === input.newStatusId) {
    return {
      isValid: true,
      alerts: [],
      hasErrors: false,
      hasWarnings: false,
      hasInfos: false,
    };
  }

  // TRANS-001: 破棄からの復活（理由必須）
  if (currentStatus?.id === TERMINAL_STATUS_IDS.DISCARDED && newStatus && !newStatus.isTerminal) {
    alerts.push(CONTRACT_STATUS_ALERT_DEFINITIONS['TRANS-001']);
  }

  // TRANS-002: 締結済みからの再開（理由必須）
  if (currentStatus?.id === TERMINAL_STATUS_IDS.SIGNED && newStatus && !newStatus.isTerminal) {
    alerts.push(CONTRACT_STATUS_ALERT_DEFINITIONS['TRANS-002']);
  }

  // アラートを深刻度でソート
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const hasErrors = alerts.some((a) => a.severity === 'ERROR');
  const hasWarnings = alerts.some((a) => a.severity === 'WARNING');
  const hasInfos = alerts.some((a) => a.severity === 'INFO');

  // 理由必須のアラートがある場合、メモが空ならバリデーション失敗
  const requiresNoteAlert = alerts.find((a) => a.requiresNote);
  const isValid = !hasErrors && (!requiresNoteAlert || Boolean(input.note && input.note.trim().length > 0));

  return {
    isValid: isValid as boolean,
    alerts,
    hasErrors,
    hasWarnings,
    hasInfos,
  };
}

/**
 * 滞留アラートをチェック（一覧表示用）
 */
export function checkStaleAlert(
  currentStatusId: number | null,
  daysSinceStatusChange: number | null
): boolean {
  // 送付済みステータスで3日以上滞留していればアラート
  if (
    currentStatusId === SENT_STATUS_ID &&
    daysSinceStatusChange !== null &&
    daysSinceStatusChange >= STALE_ALERT_DAYS
  ) {
    return true;
  }

  return false;
}

/**
 * 滞留日数を計算
 */
export function calculateDaysSinceStatusChange(
  lastHistory: ContractStatusHistoryRecord | null
): number | null {
  if (!lastHistory) {
    return null;
  }

  const now = new Date();
  const recordedAt = new Date(lastHistory.recordedAt);
  const diffTime = Math.abs(now.getTime() - recordedAt.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * 理由入力が必要かどうかをチェック
 */
export function requiresNoteForChange(
  input: ContractStatusChangeInput,
  statuses: ContractStatusInfo[]
): boolean {
  const validation = validateContractStatusChange(input, statuses);
  return validation.alerts.some((a) => a.requiresNote);
}
