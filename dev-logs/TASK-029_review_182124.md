全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## TASK-029 レビュー結果

### 対象コミット
- `abf7c09` feat(TASK-029): 実装 (attempt 1) — 新規ファイル追加
- `9df84aa` feat(TASK-029): 実装 (attempt 2) — セキュリティ修正・改善

### 仕様書との整合性チェック

**設計書 3.1 OperatingCompany追加カラム:**
| カラム | 設計書 | Prismaスキーマ | 実装 | 結果 |
|---|---|---|---|---|
| `logoPath String?` | 記載あり | 定義あり | actions.ts + logo-upload-modal.tsx | OK |
| `abbreviation String?` | 記載あり | 定義あり | columns定義 + actions.ts | OK |
| `invoicePrefix String?` | 記載あり | 定義あり | columns定義 + actions.ts | OK |
| `defaultPaymentTermDays Int?` | 記載あり | 定義あり | columns定義 + actions.ts | OK |

**設計書 ㉔ OperatingCompanyEmail テーブル:**
| カラム | 設計書 | Prismaスキーマ | 結果 |
|---|---|---|---|
| `id Int @id @default(autoincrement())` | OK | OK | 一致 |
| `operatingCompanyId Int` | OK | OK | 一致 |
| `email String` | OK | OK | 一致 |
| `label String?` | OK | OK | 一致 |
| `smtpHost/Port/User/Pass` | OK | OK | 一致 |
| `isDefault Boolean @default(false)` | OK | OK | 一致 |
| `deletedAt DateTime?` | OK | OK | 一致 |
| `createdBy/updatedBy Int?` | OK | OK | 一致 |
| Relations | OK | OK | 一致 |

**要望書 4.1 対応状況:**
- ロゴ画像アップロード・表示・削除 → OK
- 略称（abbreviation）管理 → OK
- 請求書番号プレフィックス管理 → OK
- デフォルト支払期限日数管理 → OK
- 複数メールアドレス登録（CRUD） → OK
- SMTP設定管理 → OK

### attempt 2 での改善評価

attempt 2は前回レビューで指摘されたであろうセキュリティ問題を適切に修正しています:

1. **認証・認可の追加** (`route.ts:21-33`): `auth()` + `canEditMasterDataSync` を追加 — 重要な修正
2. **smtpPassのクライアント漏洩防止** (`email-actions.ts:51`, `page.tsx:57`): `smtpPass` → `hasSmtpPass: boolean` に変更 — 重要なセキュリティ改善
3. **SMTPパスワードの条件付き更新** (`email-actions.ts:81-84`): 編集時にパスワード未入力なら既存値を保持
4. **ファイル拡張子バリデーション追加** (`route.ts:15,60-66`): MIMEタイプに加え拡張子チェックも実装
5. **ファイル名の安全化** (`route.ts:69`): 固定フォーマット `logo_{companyId}_{timestamp}{ext}` に統一

### 指摘事項

**minor-1: upload routeでcompanyIdの入力検証がない**
- `route.ts:37`: `companyId` は `formData.get()` からの任意文字列としてそのままファイル名に使用
- 数値であることの検証がなく、ファイルシステム操作に使用している
- `logo_` プレフィックスにより実質的なパストラバーサルリスクは低いが、防御的にバリデーションすべき

**minor-2: isDefault排他制御にトランザクション未使用**
- `email-actions.ts:31-40` と `92-101`: `create`/`update` と `updateMany`（他のisDefaultをfalseにする処理）が個別のクエリで実行されている
- 同時リクエスト時に複数のisDefault=trueが残りうる
- 実用上は単一ユーザー操作なのでリスクは極めて低い

**minor-3: Server Action側のemailバリデーション不足**
- `email-actions.ts:19,72`: `data.email as string` でそのまま保存
- フロント側は `type="email"` があるが、Server Action側でメールアドレス形式チェックがない

**minor-4: SMTPパスワードのクリア手段がない**
- `email-actions.ts:82`: `if (data.smtpPass)` で falsy 値はすべてスキップ
- 一度設定したSMTPパスワードを意図的に削除する方法がない（SMTP設定全体をクリアする場合に問題になりうる）

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/api/operating-companies/logo/upload/route.ts",
      "description": "companyIdの入力検証がない。formDataから取得した任意文字列がそのままファイル名に使用されている",
      "suggestion": "companyIdが数値であることを検証する: if (companyId && !/^\\d+$/.test(companyId)) { return NextResponse.json({ error: '無効なcompanyIdです' }, { status: 400 }); }"
    },
    {
      "severity": "minor",
      "file": "src/app/settings/operating-companies/email-actions.ts",
      "description": "isDefault排他制御（createとupdateMany）がトランザクション外で実行されており、同時リクエスト時にデータ不整合の可能性がある",
      "suggestion": "prisma.$transaction([...]) で create/update と updateMany をラップする"
    },
    {
      "severity": "minor",
      "file": "src/app/settings/operating-companies/email-actions.ts",
      "description": "Server Action側でメールアドレスの形式バリデーションが未実装",
      "suggestion": "正規表現またはライブラリでemailフォーマットを検証してから保存する"
    },
    {
      "severity": "minor",
      "file": "src/app/settings/operating-companies/email-actions.ts",
      "description": "一度設定したSMTPパスワードを意図的にクリアする手段がない（if (data.smtpPass) で falsy はスキップされる）",
      "suggestion": "明示的なクリアフラグ（例: data.clearSmtpPass）を追加するか、空文字列送信時にnullに設定するロジックを追加"
    }
  ],
  "summary": "仕様書（設計書3.1 + ㉔ OperatingCompanyEmail）との整合性は完全一致。attempt 2で認証・認可追加、smtpPassのクライアント漏洩防止、ファイル拡張子検証など重要なセキュリティ改善が適切に実施されている。指摘はすべてminorレベル（入力検証の強化、トランザクション化、バリデーション追加）であり、機能としては正しく動作する実装。"
}
```
