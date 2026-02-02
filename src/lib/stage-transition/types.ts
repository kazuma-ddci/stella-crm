// ステージ遷移ロジックの型定義

// イベント種別
export type StageEventType =
  | 'commit'         // 新規目標設定
  | 'achieved'       // 目標達成
  | 'recommit'       // 目標変更
  | 'progress'       // 前進
  | 'back'           // 後退
  | 'cancel'         // 目標取消
  | 'won'            // 受注
  | 'lost'           // 失注
  | 'suspended'      // 検討中へ移行
  | 'resumed'        // 検討中から再開
  | 'revived'        // 失注から復活
  | 'reason_updated';// 理由更新

// recommitのサブタイプ
export type RecommitSubType = 'positive' | 'negative' | 'neutral';

// ステージタイプ
export type StageType = 'progress' | 'closed_won' | 'closed_lost' | 'pending';

// アラートの深刻度
export type AlertSeverity = 'ERROR' | 'WARNING' | 'INFO';

// アラートID
export type AlertId =
  // 論理エラー
  | 'L-001' | 'L-002' | 'L-004' | 'L-005' | 'L-006'
  // 時系列エラー
  | 'T-001' | 'T-002' | 'T-003'
  // 遷移エラー
  | 'S-001' | 'S-002' | 'S-003' | 'S-005' | 'S-006' | 'S-007'
  // 目標管理
  | 'G-001' | 'G-002' | 'G-003' | 'G-004' | 'G-005'
  // データ整合性
  | 'D-001' | 'D-003' | 'D-004';

// アラート情報
export interface StageAlert {
  id: AlertId;
  severity: AlertSeverity;
  message: string;
  requiresNote?: boolean; // このアラートで理由入力が必須か
}

// ステージ情報
export interface StageInfo {
  id: number;
  name: string;
  displayOrder: number | null;
  stageType: StageType;
  isActive: boolean;
}

// ステージ変更入力
export interface StageChangeInput {
  // 現在の状態（変更前）
  currentStageId: number | null;
  currentTargetStageId: number | null;
  currentTargetDate: Date | null;

  // 新しい状態（変更後）
  newStageId: number | null;
  newTargetStageId: number | null;
  newTargetDate: Date | null;

  // メモ
  note?: string;
}

// 検出されたイベント
export interface DetectedEvent {
  eventType: StageEventType;
  fromStageId: number | null;
  toStageId: number | null;
  targetDate: Date | null;
  subType?: RecommitSubType;        // recommit用
  lostReason?: string;              // 失注理由
  pendingReason?: string;           // 検討中理由
}

// イベント検出結果
export interface EventDetectionResult {
  events: DetectedEvent[];
  hasChanges: boolean;
}

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  alerts: StageAlert[];
  hasErrors: boolean;
  hasWarnings: boolean;
  hasInfos: boolean;
}

// ステージ履歴（DBから取得）
export interface StageHistoryRecord {
  id: number;
  stpCompanyId: number;
  eventType: StageEventType;
  fromStageId: number | null;
  toStageId: number | null;
  targetDate: Date | null;
  recordedAt: Date;
  changedBy: string | null;
  note: string | null;
  alertAcknowledged: boolean;
  lostReason: string | null;        // 失注理由
  pendingReason: string | null;     // 検討中理由
  subType: RecommitSubType | null;  // recommit用サブタイプ
  isVoided: boolean;                // 論理削除フラグ
  fromStage?: StageInfo | null;
  toStage?: StageInfo | null;
}

// 統計情報
export interface StageStatistics {
  achievedCount: number;     // 目標達成回数
  cancelCount: number;       // 目標取消回数
  achievementRate: number;   // 目標達成率（%）
  backCount: number;         // 後退回数
  currentStageDays: number;  // 現在のステージ滞在日数
  stageStartDate: Date | null; // 現在のステージ開始日
}

// ステージ管理モーダル用データ
export interface StageManagementData {
  // 企業情報
  companyId: number;
  companyName: string;

  // 現在の状態
  currentStageId: number | null;
  currentStage: StageInfo | null;
  nextTargetStageId: number | null;
  nextTargetStage: StageInfo | null;
  nextTargetDate: Date | null;

  // 履歴
  histories: StageHistoryRecord[];

  // 統計
  statistics: StageStatistics;

  // ステージマスタ
  stages: StageInfo[];

  // 目標設定日（最新のcommitまたはrecommitのrecordedAt）
  targetSetDate: Date | null;
}

// ステージ更新パラメータ
export interface StageUpdateParams {
  stpCompanyId: number;
  newStageId: number | null;
  newTargetStageId: number | null;
  newTargetDate: Date | null;
  note?: string;
  changedBy?: string;
  alertAcknowledged?: boolean;
  lostReason?: string;              // 失注理由
  pendingReason?: string;           // 検討中理由
  pendingResponseDate?: Date | null;// 回答予定日
}
