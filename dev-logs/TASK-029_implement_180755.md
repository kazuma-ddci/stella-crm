TASK-029の実装が完了しました。以下が実装内容のまとめです。

## 実装完了: TASK-029 運営法人マスタ拡張 + メールアドレステーブル

### 変更・作成ファイル一覧

#### 既存ファイルの変更
| ファイル | 変更内容 |
|---|---|
| `src/app/settings/operating-companies/actions.ts` | `addOperatingCompany` / `updateOperatingCompany` に新フィールド（abbreviation, invoicePrefix, defaultPaymentTermDays, logoPath）を追加 |
| `src/app/settings/operating-companies/operating-companies-table.tsx` | 新カラム追加（略称、請求書番号プレフィックス、支払期限日数）、メール・ロゴ管理ボタン追加 |
| `src/app/settings/operating-companies/page.tsx` | emails リレーションの include 追加、新フィールドのデータマッピング |

#### 新規作成ファイル
| ファイル | 内容 |
|---|---|
| `src/app/api/operating-companies/logo/upload/route.ts` | ロゴ画像アップロードAPI（JPEG/PNG/GIF/WebP/SVG、5MB制限） |
| `src/app/settings/operating-companies/email-actions.ts` | OperatingCompanyEmail の CRUD Server Actions（追加・更新・論理削除、デフォルト排他制御） |
| `src/app/settings/operating-companies/emails-modal.tsx` | メールアドレス管理モーダル（SMTP設定の折りたたみ表示付き） |
| `src/app/settings/operating-companies/logo-upload-modal.tsx` | ロゴアップロード・プレビュー・削除モーダル |

### 主な機能
- **OperatingCompany拡張**: 略称、請求書番号プレフィックス、デフォルト支払期限日数をCrudTableで編集可能
- **ロゴアップロード**: モーダルからアップロード・プレビュー・削除。`/uploads/logos/` に保存
- **メールアドレス管理**: CRUD操作、SMTP個別設定（折りたたみUI）、デフォルト設定（排他制御あり）、論理削除
- **TypeScriptコンパイルエラー**: なし
