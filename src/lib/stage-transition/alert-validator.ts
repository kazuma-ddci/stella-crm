// アラート検証ロジック

import {
  StageChangeInput,
  StageInfo,
  StageAlert,
  ValidationResult,
  StageHistoryRecord,
  DetectedEvent,
} from './types';
import {
  ALERT_DEFINITIONS,
  TERMINAL_STAGE_IDS,
  NON_TARGET_STAGE_IDS,
  CONFIRM_TARGET_STAGE_IDS,
  SEVERITY_ORDER,
} from './constants';

interface ValidateOptions {
  input: StageChangeInput;
  stages: StageInfo[];
  detectedEvents: DetectedEvent[];
  histories?: StageHistoryRecord[];
  isNewRecord?: boolean;
}

/**
 * ステージ変更をバリデーション
 */
export function validateStageChange(options: ValidateOptions): ValidationResult {
  const { input, stages, detectedEvents, histories = [], isNewRecord = false } = options;
  const alerts: StageAlert[] = [];

  // ステージ情報を取得するヘルパー関数
  const getStage = (id: number | null): StageInfo | null => {
    if (id === null) return null;
    return stages.find((s) => s.id === id) ?? null;
  };

  const currentStage = getStage(input.currentStageId);
  const newStage = getStage(input.newStageId);
  const newTargetStage = getStage(input.newTargetStageId);

  // ========================================
  // カテゴリ1：論理的に矛盾している操作
  // ========================================

  // L-001: 現在より前を目標に設定
  if (input.newTargetStageId !== null && input.newStageId !== null) {
    const currentOrder = newStage?.displayOrder ?? 0;
    const targetOrder = newTargetStage?.displayOrder ?? 0;
    // 両方がprogressステージの場合のみ比較
    if (newStage?.stageType === 'progress' && newTargetStage?.stageType === 'progress') {
      if (targetOrder < currentOrder) {
        alerts.push(ALERT_DEFINITIONS['L-001']);
      }
    }
  }

  // L-002: 現在と同じを目標に設定
  if (
    input.newTargetStageId !== null &&
    input.newStageId !== null &&
    input.newTargetStageId === input.newStageId
  ) {
    alerts.push(ALERT_DEFINITIONS['L-002']);
  }

  // L-004: 目標なしで目標日だけ設定
  if (input.newTargetDate !== null && input.newTargetStageId === null) {
    alerts.push(ALERT_DEFINITIONS['L-004']);
  }

  // L-005: 失注を目標に設定（WARNING）
  if (
    input.newTargetStageId !== null &&
    CONFIRM_TARGET_STAGE_IDS.includes(input.newTargetStageId)
  ) {
    alerts.push(ALERT_DEFINITIONS['L-005']);
  }

  // L-006: 検討中を目標に設定（ERROR）
  if (
    input.newTargetStageId !== null &&
    NON_TARGET_STAGE_IDS.includes(input.newTargetStageId)
  ) {
    alerts.push(ALERT_DEFINITIONS['L-006']);
  }

  // ========================================
  // カテゴリ2：時系列的におかしい操作
  // ========================================

  if (input.newTargetDate !== null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(input.newTargetDate);
    targetDate.setHours(0, 0, 0, 0);

    // T-001: 過去の日付を目標日に設定
    if (targetDate.getTime() < today.getTime()) {
      alerts.push(ALERT_DEFINITIONS['T-001']);
    }

    // T-002: 極端に遠い未来の目標日（1年以上先）
    const oneYearLater = new Date(today);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    if (targetDate.getTime() > oneYearLater.getTime()) {
      alerts.push(ALERT_DEFINITIONS['T-002']);
    }

    // T-003: 極端に近い目標日（当日）
    if (targetDate.getTime() === today.getTime()) {
      alerts.push(ALERT_DEFINITIONS['T-003']);
    }
  }

  // ========================================
  // カテゴリ3：ステージ遷移としておかしい操作
  // ========================================

  // S-001: 3段階以上の飛び級で前進（progressステージ間のみ）
  if (input.currentStageId !== input.newStageId && currentStage && newStage) {
    if (currentStage.stageType === 'progress' && newStage.stageType === 'progress') {
      const currentOrder = currentStage.displayOrder ?? 0;
      const newOrder = newStage.displayOrder ?? 0;
      const orderDiff = Math.abs(newOrder - currentOrder);
      if (orderDiff >= 3) {
        alerts.push({
          ...ALERT_DEFINITIONS['S-001'],
          message: `ステージが「${currentStage.name}」から「${newStage.name}」へ${orderDiff}段階飛んでいます。途中のステージをスキップしますか？`,
        });
      }
    }
  }

  // S-002: 受注から他のステージに変更
  if (
    currentStage?.stageType === 'closed_won' &&
    newStage?.stageType !== 'closed_won' &&
    input.newStageId !== null
  ) {
    alerts.push({
      ...ALERT_DEFINITIONS['S-002'],
      message: `受注済みの案件を「${newStage?.name ?? '不明'}」に変更しようとしています。変更理由を入力してください。`,
    });
  }

  // S-003: 失注から進行ステージに変更（復活）
  if (
    currentStage?.stageType === 'closed_lost' &&
    newStage?.stageType === 'progress'
  ) {
    alerts.push({
      ...ALERT_DEFINITIONS['S-003'],
      message: `失注した案件を「${newStage?.name ?? '不明'}」に変更しようとしています。案件が復活した場合のみ変更してください。変更理由を入力してください。`,
    });
  }

  // S-005: 失注から検討中に変更
  if (
    currentStage?.stageType === 'closed_lost' &&
    newStage?.stageType === 'pending'
  ) {
    alerts.push(ALERT_DEFINITIONS['S-005']);
  }

  // S-006: 目標を追い越す変更
  if (
    input.currentTargetStageId !== null &&
    input.newStageId !== null &&
    input.newStageId !== input.currentTargetStageId
  ) {
    const targetOrder = getStage(input.currentTargetStageId)?.displayOrder ?? 0;
    const newOrder = newStage?.displayOrder ?? 0;
    if (newStage?.stageType === 'progress' && newOrder > targetOrder && targetOrder > 0) {
      alerts.push(ALERT_DEFINITIONS['S-006']);
    }
  }

  // S-007: 後退により目標が現在より前になる
  const isGoingBack = detectedEvents.some((e) => e.eventType === 'back');
  if (isGoingBack && input.newTargetStageId !== null) {
    const newOrder = newStage?.displayOrder ?? 0;
    const targetOrder = newTargetStage?.displayOrder ?? 0;
    if (newStage?.stageType === 'progress' && newTargetStage?.stageType === 'progress') {
      if (targetOrder <= newOrder) {
        alerts.push(ALERT_DEFINITIONS['S-007']);
      }
    }
  }

  // ========================================
  // カテゴリ4：目標管理としておかしい操作
  // ========================================

  // G-001: 目標達成前に目標を削除
  const isCanceling = detectedEvents.some((e) => e.eventType === 'cancel');
  if (isCanceling && input.currentTargetStageId !== null) {
    const targetStage = getStage(input.currentTargetStageId);
    alerts.push({
      ...ALERT_DEFINITIONS['G-001'],
      message: `目標「${targetStage?.name ?? '不明'}」を達成する前に削除しようとしています。理由を入力してください。`,
    });
  }

  // G-002: 1週間以内に3回以上の目標変更（履歴が必要）
  if (!isNewRecord && histories.length > 0) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentTargetChanges = histories.filter((h) => {
      const recordDate = new Date(h.recordedAt);
      return (
        recordDate >= oneWeekAgo &&
        !h.isVoided &&
        (h.eventType === 'commit' || h.eventType === 'recommit' || h.eventType === 'cancel')
      );
    });

    if (recentTargetChanges.length >= 2 && detectedEvents.some(e => e.eventType === 'commit' || e.eventType === 'recommit')) {
      alerts.push({
        ...ALERT_DEFINITIONS['G-002'],
        message: `直近1週間で目標が${recentTargetChanges.length}回変更されています。`,
      });
    }
  }

  // G-003: 同じ目標に対して3回以上の延期（履歴が必要）
  if (!isNewRecord && histories.length > 0 && input.newTargetStageId !== null) {
    // 同じ目標ステージに対するrecommitで日付が後ろに変更されたケースをカウント
    const sameTargetRecommits = histories.filter(
      (h) =>
        !h.isVoided &&
        h.eventType === 'recommit' &&
        h.toStageId === input.newTargetStageId &&
        h.subType === 'negative'
    );

    if (sameTargetRecommits.length >= 2 && detectedEvents.some(e => e.eventType === 'recommit' && e.subType === 'negative')) {
      const targetStage = getStage(input.newTargetStageId);
      alerts.push({
        ...ALERT_DEFINITIONS['G-003'],
        message: `目標「${targetStage?.name ?? '不明'}」の達成日が${sameTargetRecommits.length + 1}回延期されています。`,
      });
    }
  }

  // G-004: 目標日を2週間以上前倒し
  if (
    input.currentTargetDate !== null &&
    input.newTargetDate !== null &&
    input.currentTargetStageId === input.newTargetStageId // 同じ目標の日付変更
  ) {
    const currentDate = new Date(input.currentTargetDate);
    const newDate = new Date(input.newTargetDate);
    const diffDays = Math.floor(
      (currentDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays >= 14) {
      alerts.push({
        ...ALERT_DEFINITIONS['G-004'],
        message: `目標日が${diffDays}日前倒しされました。`,
      });
    }
  }

  // G-005: 達成と同時に同じステージを次の目標に設定
  const isAchieving = detectedEvents.some((e) => e.eventType === 'achieved');
  if (isAchieving && input.newTargetStageId !== null && input.newStageId === input.newTargetStageId) {
    const stage = getStage(input.newStageId);
    alerts.push({
      ...ALERT_DEFINITIONS['G-005'],
      message: `今到達したステージ「${stage?.name ?? '不明'}」を次の目標に設定することはできません。`,
    });
  }

  // ========================================
  // カテゴリ5：データ整合性の問題
  // ========================================

  // D-001: 現在のステージがNULLになる
  if (input.newStageId === null && !isNewRecord) {
    alerts.push(ALERT_DEFINITIONS['D-001']);
  }

  // D-003: 目標ステージなしで目標日あり
  if (input.newTargetDate !== null && input.newTargetStageId === null) {
    // L-004と重複するが、より具体的なメッセージ
    // L-004が既に追加されているので、ここでは追加しない
  }

  // D-004: 後退時に理由が未入力
  if (isGoingBack && !input.note) {
    alerts.push(ALERT_DEFINITIONS['D-004']);
  }

  // ========================================
  // 結果を整理
  // ========================================

  // 深刻度でソート
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const hasErrors = alerts.some((a) => a.severity === 'ERROR');
  const hasWarnings = alerts.some((a) => a.severity === 'WARNING');
  const hasInfos = alerts.some((a) => a.severity === 'INFO');

  return {
    isValid: !hasErrors,
    alerts,
    hasErrors,
    hasWarnings,
    hasInfos,
  };
}

/**
 * 新規登録時のバリデーション
 */
export function validateInitialStage(
  currentStageId: number | null,
  targetStageId: number | null,
  targetDate: Date | null,
  stages: StageInfo[]
): ValidationResult {
  const input: StageChangeInput = {
    currentStageId: null,
    currentTargetStageId: null,
    currentTargetDate: null,
    newStageId: currentStageId,
    newTargetStageId: targetStageId,
    newTargetDate: targetDate,
  };

  return validateStageChange({
    input,
    stages,
    detectedEvents: [],
    histories: [],
    isNewRecord: true,
  });
}

/**
 * 理由入力が必要なアラートがあるかチェック
 */
export function hasAlertsRequiringNote(alerts: StageAlert[]): boolean {
  return alerts.some((a) => a.requiresNote && a.severity !== 'ERROR');
}

/**
 * 保存を続行できるかチェック
 * ERRORがある場合は続行不可
 * WARNINGがある場合は確認が必要（noteが入力されていれば続行可能）
 */
export function canProceed(
  validation: ValidationResult,
  noteProvided: boolean,
  acknowledged: boolean
): boolean {
  if (validation.hasErrors) {
    return false;
  }

  if (validation.hasWarnings) {
    const requiresNote = hasAlertsRequiringNote(validation.alerts);
    if (requiresNote && !noteProvided) {
      return false;
    }
    return acknowledged;
  }

  return true;
}
