// イベント検出ロジック

import {
  StageChangeInput,
  StageInfo,
  DetectedEvent,
  EventDetectionResult,
  StageEventType,
  RecommitSubType,
} from './types';

/**
 * ステージ変更からイベントを検出する
 * stageTypeを使用した判定ロジック
 */
export function detectEvents(
  input: StageChangeInput,
  stages: StageInfo[]
): EventDetectionResult {
  const events: DetectedEvent[] = [];

  // ステージ情報を取得するヘルパー関数
  const getStage = (id: number | null): StageInfo | null => {
    if (id === null) return null;
    return stages.find((s) => s.id === id) ?? null;
  };

  const currentStage = getStage(input.currentStageId);
  const newStage = getStage(input.newStageId);

  // 変更があったかどうかをチェック
  const stageChanged = input.currentStageId !== input.newStageId;
  const targetStageChanged = input.currentTargetStageId !== input.newTargetStageId;
  const targetDateChanged = datesDiffer(input.currentTargetDate, input.newTargetDate);
  const targetRelatedChanged = targetStageChanged || targetDateChanged;

  // 何も変更されていない場合
  if (!stageChanged && !targetRelatedChanged) {
    return { events: [], hasChanges: false };
  }

  // ステージが変更された場合
  if (stageChanged && currentStage && newStage) {
    const stageEvent = detectStageTransitionEvent(currentStage, newStage, input);
    if (stageEvent) {
      events.push(stageEvent);
    }

    // 目標達成の場合
    if (input.currentTargetStageId !== null && input.newStageId === input.currentTargetStageId) {
      // achieved イベントを追加（stageEventがprogress等でない場合）
      if (!stageEvent || !['won', 'lost', 'suspended'].includes(stageEvent.eventType)) {
        events.unshift({
          eventType: 'achieved',
          fromStageId: input.currentStageId,
          toStageId: input.newStageId,
          targetDate: null,
        });
      }

      // 達成と同時に新しい目標が設定された場合 → +commit
      if (input.newTargetStageId !== null) {
        events.push({
          eventType: 'commit',
          fromStageId: input.newStageId,
          toStageId: input.newTargetStageId,
          targetDate: input.newTargetDate,
        });
      }
    } else if (targetRelatedChanged) {
      // 目標関連も同時に変更された場合
      // ただし、won/lost/suspendedへの遷移時は目標が自動クリアされるため、cancelは不要
      const isAutoTargetClear = stageEvent && ['won', 'lost', 'suspended'].includes(stageEvent.eventType);

      if (!isAutoTargetClear || input.newTargetStageId !== null) {
        // 自動クリアでない場合、または新しい目標が同時に設定された場合のみイベント検出
        const targetEvent = detectTargetEvent(
          input.currentTargetStageId,
          input.newTargetStageId,
          input.currentTargetDate,
          input.newTargetDate,
          stages
        );
        if (targetEvent) {
          events.push(targetEvent);
        }
      }
    }
  } else if (stageChanged && !currentStage && newStage) {
    // 新規登録時（currentStageがnull）
    const stageEvent = detectStageTransitionEvent(null, newStage, input);
    if (stageEvent) {
      events.push(stageEvent);
    }

    if (targetRelatedChanged) {
      const targetEvent = detectTargetEvent(
        input.currentTargetStageId,
        input.newTargetStageId,
        input.currentTargetDate,
        input.newTargetDate,
        stages
      );
      if (targetEvent) {
        events.push(targetEvent);
      }
    }
  } else if (!stageChanged && targetRelatedChanged) {
    // ステージは変更されず、目標関連のみ変更された場合
    const targetEvent = detectTargetEvent(
      input.currentTargetStageId,
      input.newTargetStageId,
      input.currentTargetDate,
      input.newTargetDate,
      stages
    );
    if (targetEvent) {
      events.push(targetEvent);
    }
  }

  return { events, hasChanges: events.length > 0 || targetDateChanged };
}

/**
 * ステージ遷移イベントを検出（stageType対応）
 */
function detectStageTransitionEvent(
  currentStage: StageInfo | null,
  newStage: StageInfo,
  input: StageChangeInput
): DetectedEvent | null {
  const currentType = currentStage?.stageType ?? null;
  const newType = newStage.stageType;

  // 進行ステージへの遷移
  if (newType === 'progress') {
    if (!currentStage) {
      // 新規登録
      return {
        eventType: 'progress',
        fromStageId: null,
        toStageId: newStage.id,
        targetDate: null,
      };
    }

    if (currentType === 'pending') {
      // 検討中 → 進行ステージ: resumed
      return {
        eventType: 'resumed',
        fromStageId: currentStage.id,
        toStageId: newStage.id,
        targetDate: null,
      };
    }

    if (currentType === 'closed_lost') {
      // 失注 → 進行ステージ: revived
      return {
        eventType: 'revived',
        fromStageId: currentStage.id,
        toStageId: newStage.id,
        targetDate: null,
      };
    }

    if (currentType === 'closed_won') {
      // 受注 → 進行ステージ: back（契約取消）
      return {
        eventType: 'back',
        fromStageId: currentStage.id,
        toStageId: newStage.id,
        targetDate: null,
      };
    }

    if (currentType === 'progress') {
      // 進行ステージ間の移動
      const currentOrder = currentStage.displayOrder ?? 0;
      const newOrder = newStage.displayOrder ?? 0;

      if (newOrder > currentOrder) {
        return {
          eventType: 'progress',
          fromStageId: currentStage.id,
          toStageId: newStage.id,
          targetDate: null,
        };
      } else if (newOrder < currentOrder) {
        return {
          eventType: 'back',
          fromStageId: currentStage.id,
          toStageId: newStage.id,
          targetDate: null,
        };
      }
    }
  }

  // 受注への遷移
  if (newType === 'closed_won') {
    return {
      eventType: 'won',
      fromStageId: currentStage?.id ?? null,
      toStageId: newStage.id,
      targetDate: null,
    };
  }

  // 失注への遷移
  if (newType === 'closed_lost') {
    return {
      eventType: 'lost',
      fromStageId: currentStage?.id ?? null,
      toStageId: newStage.id,
      targetDate: null,
      lostReason: input.note, // noteを失注理由として使用
    };
  }

  // 検討中への遷移
  if (newType === 'pending') {
    return {
      eventType: 'suspended',
      fromStageId: currentStage?.id ?? null,
      toStageId: newStage.id,
      targetDate: null,
      pendingReason: input.note, // noteを検討中理由として使用
    };
  }

  return null;
}

/**
 * 目標関連の変更からイベントを検出（サブタイプ対応）
 */
function detectTargetEvent(
  currentTargetStageId: number | null,
  newTargetStageId: number | null,
  currentTargetDate: Date | null,
  newTargetDate: Date | null,
  stages: StageInfo[]
): DetectedEvent | null {
  const hadTarget = currentTargetStageId !== null;
  const hasTarget = newTargetStageId !== null;

  if (!hadTarget && hasTarget) {
    // NULL → 値あり: commit
    return {
      eventType: 'commit',
      fromStageId: null,
      toStageId: newTargetStageId,
      targetDate: newTargetDate,
    };
  } else if (hadTarget && hasTarget) {
    // 値あり → 別の値または日付変更: recommit
    const stageChanged = currentTargetStageId !== newTargetStageId;
    const dateChanged = datesDiffer(currentTargetDate, newTargetDate);

    if (stageChanged || dateChanged) {
      const subType = determineRecommitSubType(
        currentTargetStageId,
        newTargetStageId,
        currentTargetDate,
        newTargetDate,
        stages
      );

      return {
        eventType: 'recommit',
        fromStageId: currentTargetStageId,
        toStageId: newTargetStageId,
        targetDate: newTargetDate,
        subType,
      };
    }
  } else if (hadTarget && !hasTarget) {
    // 値あり → NULL: cancel
    return {
      eventType: 'cancel',
      fromStageId: null,
      toStageId: currentTargetStageId, // 取り消した目標を記録
      targetDate: null,
    };
  }

  return null;
}

/**
 * recommitのサブタイプを判定
 */
function determineRecommitSubType(
  currentTargetStageId: number | null,
  newTargetStageId: number | null,
  currentTargetDate: Date | null,
  newTargetDate: Date | null,
  stages: StageInfo[]
): RecommitSubType {
  const currentStage = stages.find((s) => s.id === currentTargetStageId);
  const newStage = stages.find((s) => s.id === newTargetStageId);

  const stageChanged = currentTargetStageId !== newTargetStageId;
  const dateChanged = datesDiffer(currentTargetDate, newTargetDate);

  // ステージの変化を判定
  let stageDirection: 'up' | 'down' | 'same' = 'same';
  if (stageChanged && currentStage && newStage) {
    const currentOrder = currentStage.displayOrder ?? 0;
    const newOrder = newStage.displayOrder ?? 0;
    if (newOrder > currentOrder) {
      stageDirection = 'up'; // 引き上げ
    } else if (newOrder < currentOrder) {
      stageDirection = 'down'; // 引き下げ
    }
  }

  // 日付の変化を判定
  let dateDirection: 'earlier' | 'later' | 'same' | 'new' | 'removed' = 'same';
  if (dateChanged) {
    if (currentTargetDate === null && newTargetDate !== null) {
      dateDirection = 'new';
    } else if (currentTargetDate !== null && newTargetDate === null) {
      dateDirection = 'removed';
    } else if (currentTargetDate !== null && newTargetDate !== null) {
      const current = new Date(currentTargetDate);
      const next = new Date(newTargetDate);
      current.setHours(0, 0, 0, 0);
      next.setHours(0, 0, 0, 0);
      if (next.getTime() < current.getTime()) {
        dateDirection = 'earlier'; // 前倒し
      } else {
        dateDirection = 'later'; // 延期
      }
    }
  }

  // サブタイプを判定
  if (stageChanged && dateChanged) {
    // 両方変更された場合
    if (stageDirection === 'up' && dateDirection === 'earlier') {
      return 'positive';
    }
    if (stageDirection === 'down' && dateDirection === 'later') {
      return 'negative';
    }
    return 'neutral';
  } else if (stageChanged) {
    // ステージのみ変更
    return stageDirection === 'up' ? 'positive' : stageDirection === 'down' ? 'negative' : 'neutral';
  } else if (dateChanged) {
    // 日付のみ変更
    return dateDirection === 'earlier' ? 'positive' : dateDirection === 'later' ? 'negative' : 'neutral';
  }

  return 'neutral';
}

/**
 * 日付が異なるかどうかをチェック
 */
function datesDiffer(date1: Date | null, date2: Date | null): boolean {
  if (date1 === null && date2 === null) return false;
  if (date1 === null || date2 === null) return true;

  // 日付のみで比較（時刻は無視）
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  return d1.getTime() !== d2.getTime();
}

/**
 * 新規登録時のイベントを生成
 */
export function detectInitialEvents(
  currentStageId: number | null,
  targetStageId: number | null,
  targetDate: Date | null
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  // 現在のステージが設定されている場合 → progress
  if (currentStageId !== null) {
    events.push({
      eventType: 'progress',
      fromStageId: null, // 新規登録なのでfromはnull
      toStageId: currentStageId,
      targetDate: null,
    });
  }

  // 目標も同時に設定された場合 → commit
  if (targetStageId !== null) {
    events.push({
      eventType: 'commit',
      fromStageId: currentStageId,
      toStageId: targetStageId,
      targetDate: targetDate,
    });
  }

  return events;
}

/**
 * イベント種別の説明文を生成
 */
export function getEventDescription(
  event: DetectedEvent,
  stages: StageInfo[]
): string {
  const getStage = (id: number | null): StageInfo | null => {
    if (id === null) return null;
    return stages.find((s) => s.id === id) ?? null;
  };

  const fromStage = getStage(event.fromStageId);
  const toStage = getStage(event.toStageId);

  switch (event.eventType) {
    case 'commit':
      return `${toStage?.name ?? '不明'}を目標に設定`;
    case 'achieved':
      return `${toStage?.name ?? '不明'}に到達`;
    case 'recommit':
      return `目標を${toStage?.name ?? '不明'}に変更`;
    case 'progress':
      if (fromStage) {
        return `${fromStage.name} → ${toStage?.name ?? '不明'}`;
      }
      return `${toStage?.name ?? '不明'}で開始`;
    case 'back':
      return `${fromStage?.name ?? '不明'} → ${toStage?.name ?? '不明'}`;
    case 'cancel':
      return `目標「${toStage?.name ?? '不明'}」を取消`;
    case 'won':
      return `受注`;
    case 'lost':
      return `失注`;
    case 'suspended':
      return `検討中に移行`;
    case 'resumed':
      return `検討中から再開`;
    case 'revived':
      return `失注から復活`;
    case 'reason_updated':
      return `理由を更新`;
    default:
      return '';
  }
}

/**
 * 変更の種類を判定（UI表示用）
 */
export function getChangeType(
  currentStageId: number | null,
  newStageId: number | null,
  targetStageId: number | null,
  stages: StageInfo[]
): {
  type: 'achieved' | 'progress' | 'back' | 'won' | 'lost' | 'suspended' | 'resumed' | 'revived' | 'none';
  message: string;
} {
  if (currentStageId === newStageId) {
    return { type: 'none', message: '' };
  }

  const currentStage = stages.find((s) => s.id === currentStageId);
  const newStage = stages.find((s) => s.id === newStageId);

  if (!newStage) {
    return { type: 'none', message: '' };
  }

  // stageTypeによる判定
  const newType = newStage.stageType;
  const currentType = currentStage?.stageType;

  // 受注に変更
  if (newType === 'closed_won') {
    return { type: 'won', message: '🎊 受注おめでとうございます！' };
  }

  // 失注に変更
  if (newType === 'closed_lost') {
    return { type: 'lost', message: 'この案件を失注として記録します' };
  }

  // 検討中に変更
  if (newType === 'pending') {
    return { type: 'suspended', message: '⏸️ この案件を検討中として記録します' };
  }

  // 検討中から再開
  if (currentType === 'pending' && newType === 'progress') {
    return { type: 'resumed', message: '▶️ 検討中から再開します' };
  }

  // 失注から復活
  if (currentType === 'closed_lost' && newType === 'progress') {
    return { type: 'revived', message: '🔄 失注から復活します' };
  }

  // 目標達成
  if (newStageId === targetStageId) {
    return { type: 'achieved', message: '🎉 目標達成です！おめでとうございます！' };
  }

  // 進行ステージ間の移動
  if (currentStage && currentType === 'progress' && newType === 'progress') {
    const currentOrder = currentStage.displayOrder ?? 0;
    const newOrder = newStage.displayOrder ?? 0;

    if (newOrder > currentOrder) {
      const targetOrder = stages.find((s) => s.id === targetStageId)?.displayOrder ?? 0;
      const stepsToTarget = targetOrder - newOrder;
      if (stepsToTarget > 0) {
        return {
          type: 'progress',
          message: `📈 前進します（目標まであと${stepsToTarget}ステージ）`,
        };
      }
      return { type: 'progress', message: '📈 前進します' };
    }

    if (newOrder < currentOrder) {
      return { type: 'back', message: '📉 後退します' };
    }
  }

  return { type: 'none', message: '' };
}
