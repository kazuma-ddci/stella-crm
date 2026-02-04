// 契約書ステータスのイベント検出ロジック

import {
  ContractStatusChangeInput,
  ContractStatusInfo,
  DetectedContractStatusEvent,
  ContractStatusEventDetectionResult,
  ContractStatusEventType,
} from './types';
import { TERMINAL_STATUS_IDS } from './constants';

/**
 * ステータス変更からイベントを検出する
 */
export function detectContractStatusEvent(
  input: ContractStatusChangeInput,
  statuses: ContractStatusInfo[]
): ContractStatusEventDetectionResult {
  // ステータス情報を取得するヘルパー関数
  const getStatus = (id: number | null): ContractStatusInfo | null => {
    if (id === null) return null;
    return statuses.find((s) => s.id === id) ?? null;
  };

  const currentStatus = getStatus(input.currentStatusId);
  const newStatus = getStatus(input.newStatusId);

  // 変更があったかどうかをチェック
  const statusChanged = input.currentStatusId !== input.newStatusId;

  // 何も変更されていない場合
  if (!statusChanged) {
    return { event: null, hasChanges: false };
  }

  // 新しいステータスが設定されていない場合
  if (!newStatus) {
    return { event: null, hasChanges: false };
  }

  // イベントタイプを検出
  const eventType = detectEventType(currentStatus, newStatus);

  return {
    event: {
      eventType,
      fromStatusId: input.currentStatusId,
      toStatusId: input.newStatusId,
    },
    hasChanges: true,
  };
}

/**
 * ステータス遷移からイベントタイプを検出
 */
function detectEventType(
  currentStatus: ContractStatusInfo | null,
  newStatus: ContractStatusInfo
): ContractStatusEventType {
  // 新規作成（currentStatusがnull）
  if (!currentStatus) {
    return 'created';
  }

  const currentIsTerminal = currentStatus.isTerminal;
  const newIsTerminal = newStatus.isTerminal;
  const currentOrder = currentStatus.displayOrder;
  const newOrder = newStatus.displayOrder;

  // 締結済みへの遷移
  if (newStatus.id === TERMINAL_STATUS_IDS.SIGNED) {
    return 'signed';
  }

  // 破棄への遷移
  if (newStatus.id === TERMINAL_STATUS_IDS.DISCARDED) {
    return 'discarded';
  }

  // 破棄から進行中への復活
  if (currentStatus.id === TERMINAL_STATUS_IDS.DISCARDED && !newIsTerminal) {
    return 'revived';
  }

  // 締結済みから進行中への再開
  if (currentStatus.id === TERMINAL_STATUS_IDS.SIGNED && !newIsTerminal) {
    return 'reopened';
  }

  // 進行中ステータス間の移動
  if (!currentIsTerminal && !newIsTerminal) {
    if (newOrder > currentOrder) {
      return 'progress'; // 前進
    } else if (newOrder < currentOrder) {
      return 'back'; // 後退
    }
  }

  // 終了ステータスから別の終了ステータスへ（破棄→締結など）
  if (currentIsTerminal && newIsTerminal) {
    // 締結に変更
    if (newStatus.id === TERMINAL_STATUS_IDS.SIGNED) {
      return 'signed';
    }
    // 破棄に変更
    if (newStatus.id === TERMINAL_STATUS_IDS.DISCARDED) {
      return 'discarded';
    }
  }

  // デフォルトは前進として扱う
  return 'progress';
}

/**
 * 新規作成時のイベントを生成
 */
export function createInitialEvent(
  statusId: number | null
): DetectedContractStatusEvent | null {
  if (statusId === null) {
    return null;
  }

  return {
    eventType: 'created',
    fromStatusId: null,
    toStatusId: statusId,
  };
}

/**
 * イベント種別の説明文を生成
 */
export function getContractStatusEventDescription(
  event: DetectedContractStatusEvent,
  statuses: ContractStatusInfo[]
): string {
  const getStatus = (id: number | null): ContractStatusInfo | null => {
    if (id === null) return null;
    return statuses.find((s) => s.id === id) ?? null;
  };

  const fromStatus = getStatus(event.fromStatusId);
  const toStatus = getStatus(event.toStatusId);

  switch (event.eventType) {
    case 'created':
      return `${toStatus?.name ?? '不明'}で作成`;
    case 'progress':
      return `${fromStatus?.name ?? '不明'} → ${toStatus?.name ?? '不明'}`;
    case 'back':
      return `${fromStatus?.name ?? '不明'} → ${toStatus?.name ?? '不明'}`;
    case 'signed':
      return '締結';
    case 'discarded':
      return '破棄';
    case 'revived':
      return `破棄から復活 → ${toStatus?.name ?? '不明'}`;
    case 'reopened':
      return `締結済みから再開 → ${toStatus?.name ?? '不明'}`;
    default:
      return '';
  }
}

/**
 * 変更の種類を判定（UI表示用）
 */
export function getContractStatusChangeType(
  currentStatusId: number | null,
  newStatusId: number | null,
  statuses: ContractStatusInfo[]
): {
  type: ContractStatusEventType | 'none';
  message: string;
} {
  if (currentStatusId === newStatusId) {
    return { type: 'none', message: '' };
  }

  const currentStatus = statuses.find((s) => s.id === currentStatusId);
  const newStatus = statuses.find((s) => s.id === newStatusId);

  if (!newStatus) {
    return { type: 'none', message: '' };
  }

  // 締結に変更
  if (newStatus.id === TERMINAL_STATUS_IDS.SIGNED) {
    return { type: 'signed', message: '✅ 契約書を締結として記録します' };
  }

  // 破棄に変更
  if (newStatus.id === TERMINAL_STATUS_IDS.DISCARDED) {
    return { type: 'discarded', message: '🗑️ 契約書を破棄として記録します' };
  }

  // 破棄から復活
  if (currentStatus?.id === TERMINAL_STATUS_IDS.DISCARDED) {
    return { type: 'revived', message: '🔄 破棄された契約書を復活します' };
  }

  // 締結済みから再開
  if (currentStatus?.id === TERMINAL_STATUS_IDS.SIGNED) {
    return { type: 'reopened', message: '▶️ 締結済みの契約書を再開します' };
  }

  // 進行中ステータス間の移動
  if (currentStatus && !currentStatus.isTerminal && !newStatus.isTerminal) {
    const currentOrder = currentStatus.displayOrder;
    const newOrder = newStatus.displayOrder;

    if (newOrder > currentOrder) {
      return { type: 'progress', message: '📈 ステータスを進めます' };
    }

    if (newOrder < currentOrder) {
      return { type: 'back', message: '📉 ステータスを戻します' };
    }
  }

  // 新規作成
  if (!currentStatus) {
    return { type: 'created', message: '📝 新規作成します' };
  }

  return { type: 'none', message: '' };
}
