// 契約書ステータス管理の型定義

// イベント種別
export type ContractStatusEventType =
  | 'created'    // 新規作成
  | 'progress'   // 前進
  | 'back'       // 後退
  | 'signed'     // 締結
  | 'discarded'  // 破棄
  | 'revived'    // 破棄から復活
  | 'reopened';  // 締結済みから再開

// アラートの深刻度
export type AlertSeverity = 'ERROR' | 'WARNING' | 'INFO';

// アラートID
export type ContractStatusAlertId =
  | 'STALE-001'    // 送付済みで3日以上滞留
  | 'TRANS-001'    // 破棄からの復活（理由必須）
  | 'TRANS-002';   // 締結済みからの再開（理由必須）

// アラート情報
export interface ContractStatusAlert {
  id: ContractStatusAlertId;
  severity: AlertSeverity;
  message: string;
  requiresNote?: boolean;
}

// 契約書ステータス情報
export interface ContractStatusInfo {
  id: number;
  name: string;
  displayOrder: number;
  isTerminal: boolean;
  isActive: boolean;
}

// ステータス変更入力
export interface ContractStatusChangeInput {
  // 現在の状態（変更前）
  currentStatusId: number | null;

  // 新しい状態（変更後）
  newStatusId: number | null;

  // メモ
  note?: string;
}

// 検出されたイベント
export interface DetectedContractStatusEvent {
  eventType: ContractStatusEventType;
  fromStatusId: number | null;
  toStatusId: number | null;
}

// イベント検出結果
export interface ContractStatusEventDetectionResult {
  event: DetectedContractStatusEvent | null;
  hasChanges: boolean;
}

// バリデーション結果
export interface ContractStatusValidationResult {
  isValid: boolean;
  alerts: ContractStatusAlert[];
  hasErrors: boolean;
  hasWarnings: boolean;
  hasInfos: boolean;
}

// ステータス履歴（DBから取得）
export interface ContractStatusHistoryRecord {
  id: number;
  contractId: number;
  eventType: ContractStatusEventType;
  fromStatusId: number | null;
  toStatusId: number | null;
  recordedAt: Date;
  changedBy: string | null;
  note: string | null;
  fromStatus?: ContractStatusInfo | null;
  toStatus?: ContractStatusInfo | null;
}

// 統計情報
export interface ContractStatusStatistics {
  totalChanges: number;        // 総変更回数
  averageDaysPerStatus: number; // 平均滞在日数
  currentStatusDays: number;   // 現在のステータス滞在日数
  statusStartDate: Date | null; // 現在のステータス開始日
}

// 契約書のステータス管理用データ
export interface ContractStatusManagementData {
  // 契約書情報
  contractId: number;
  contractTitle: string;
  companyName: string;
  assignedTo: string | null;

  // 現在の状態
  currentStatusId: number | null;
  currentStatus: ContractStatusInfo | null;

  // 履歴
  histories: ContractStatusHistoryRecord[];

  // 統計
  statistics: ContractStatusStatistics;

  // ステータスマスタ
  statuses: ContractStatusInfo[];
}

// ステータス更新パラメータ
export interface ContractStatusUpdateParams {
  contractId: number;
  newStatusId: number | null;
  note?: string;
  alertAcknowledged?: boolean;
  signedDate?: string; // 締結日（締結済みステータスの場合）
}

// 契約書の一覧表示用データ（タブフィルタリング用）
export type ContractTabType = 'in_progress' | 'signed' | 'discarded';

// 契約書一覧の行データ（進捗表示用拡張）
export interface ContractRowWithProgress {
  id: number;
  companyId: number;
  companyName: string;
  contractType: string;
  title: string;
  contractNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  currentStatusId: number | null;
  currentStatusName: string | null;
  currentStatusDisplayOrder: number | null;
  currentStatusIsTerminal: boolean;
  signedDate: string | null;
  signingMethod: string | null;
  filePath: string | null;
  fileName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  // 進捗表示用
  daysSinceStatusChange: number | null;
  hasStaleAlert: boolean;
}
