TASK-026: 通知機能の実装が完了しました。

## 実装サマリー

### 新規作成ファイル

| ファイル | 内容 |
|---|---|
| `src/app/notifications/actions.ts` | Server Actions: `listNotifications`, `updateNotificationStatus`, `markAllAsRead`, `createNotification`, `getUnreadNotificationCount` |
| `src/app/notifications/page.tsx` | 通知一覧ページ（サーバーコンポーネント） |
| `src/app/notifications/notification-table.tsx` | 通知テーブル（クライアントコンポーネント）— ステータス/カテゴリフィルタ、ステータス変更、リンク遷移、一括既読 |
| `src/lib/notifications/create-notification.ts` | 通知発行ヘルパー関数（`createNotification`, `createNotificationBulk`） |
| `src/components/layout/notification-bell.tsx` | ヘッダーベルアイコン + 未読件数バッジ（60秒ポーリング） |

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/components/layout/header.tsx` | ベルアイコン（`NotificationBell`）を UserMenu の左に追加 |
| `src/components/layout/sidebar.tsx` | サイドバーに「通知」ナビゲーション追加 |
| `src/app/accounting/transactions/actions.ts` | 差し戻し時に作成者への通知送信、按分確定依頼通知のトランザクション後送信 |
| `src/app/accounting/transactions/allocation-actions.ts` | 按分確定依頼の通知対象収集（戻り値パターン）+ `sendAllocationNotifications` 関数 |

### 仕様準拠
- ステータス遷移: `unread → read → in_progress → completed`
- カテゴリ: `finance / accounting / kpi / system / other`
- `statusChangedAt`, `statusChangedBy` の記録
- 自分宛（`recipientId = currentStaffId`）のみ表示
- `senderId` で発信者追跡（`createdBy/updatedBy` なし — 設計書 6.10 準拠）
