レビューに必要な情報がすべて揃いました。以下がレビュー結果です。

---

## TASK-029 コードレビュー: 運営法人マスタ拡張 + メールアドレステーブル

### 1. テーブル定義の整合性チェック

**OperatingCompany 追加カラム** — 設計書 3.1 と一致
| 設計書 | Prismaスキーマ | 判定 |
|--------|---------------|------|
| `logoPath String?` | `logoPath String?` | OK |
| `abbreviation String?` | `abbreviation String?` | OK |
| `invoicePrefix String?` | `invoicePrefix String?` | OK |
| `defaultPaymentTermDays Int?` | `defaultPaymentTermDays Int?` | OK |
| `emails OperatingCompanyEmail[]` | `emails OperatingCompanyEmail[]` | OK |

**OperatingCompanyEmail (㉔)** — 設計書と完全一致
全カラム（id, operatingCompanyId, email, label, smtpHost, smtpPort, smtpUser, smtpPass, isDefault, deletedAt, createdBy, updatedBy, createdAt, updatedAt）およびリレーションが設計書通り。

### 2. セキュリティ問題

**P1: ロゴアップロードAPIに認証なし**
`src/app/api/operating-companies/logo/upload/route.ts` には `auth()` による認証チェックが一切ない。既存の全APIルート（`/api/companies/[id]`, `/api/admin/users`等）は `const session = await auth()` で認証を行っている。未認証ユーザーが任意のファイルをサーバーにアップロード可能。

**P2: SMTPパスワードがクライアントに送信されている**
`page.tsx:57` で `smtpPass: e.smtpPass` がクライアントコンポーネントのpropsとして渡されている。Next.jsのServer Component→Client Component間のデータはHTMLに埋め込まれるため、ページソースから全てのSMTPパスワードが閲覧可能。

**P3: ファイル拡張子未検証**
アップロードAPIはMIMEタイプ (`file.type`) のみチェックしているが、保存時のファイル名拡張子は `path.extname(file.name)` から取得している。攻撃者がContent-Typeを `image/png` に偽装し、ファイル名を `evil.html` にすれば、HTMLファイルがpublicディレクトリに保存され、XSSが成立する。

### 3. コード品質

**未使用import**
`operating-companies-table.tsx:2` で `useRef`, `useCallback` がインポートされているが使用されていない。

### 4. 良い点

- `email-actions.ts` の認証チェック (`requireMasterDataEditPermission`) は適切
- `createdBy` / `updatedBy` の記録が設計書通り
- `isDefault` の排他制御（同一法人内で1つだけ）が正しく実装されている
- 論理削除 (`deletedAt`) パターンに準拠
- `deletedAt: null` フィルタがクエリに含まれている
- UIの作りがBankAccountsModalの既存パターンに準拠

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "critical",
      "file": "src/app/api/operating-companies/logo/upload/route.ts",
      "description": "認証チェックが一切ない。未認証ユーザーが任意のファイルをアップロード可能",
      "suggestion": "import { auth } from '@/auth'; を追加し、POST関数の冒頭で const session = await auth(); if (!session?.user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 }); を追加。さらに requireMasterDataEditPermission 相当の権限チェックも追加する"
    },
    {
      "severity": "critical",
      "file": "src/app/settings/operating-companies/page.tsx",
      "description": "smtpPass（SMTPパスワード）がクライアントコンポーネントのpropsとして送信されており、ブラウザのHTMLソースからパスワードが閲覧可能",
      "suggestion": "page.tsxのemailsマッピングでsmtpPassを除外するか、マスク化する（例: smtpPass: e.smtpPass ? '********' : null）。編集時のパスワード更新はサーバー側で「空なら変更しない」ロジックで対応する"
    },
    {
      "severity": "major",
      "file": "src/app/api/operating-companies/logo/upload/route.ts",
      "description": "MIMEタイプのみチェックし、ファイル拡張子を検証していない。Content-Typeを偽装して.htmlファイルをアップロードすればXSS攻撃が可能",
      "suggestion": "許可する拡張子のホワイトリスト（.jpg, .jpeg, .png, .gif, .webp, .svg）を定義し、path.extname(file.name).toLowerCase() で拡張子を検証する。MIMEタイプと拡張子の両方が一致する場合のみ許可"
    },
    {
      "severity": "minor",
      "file": "src/app/settings/operating-companies/operating-companies-table.tsx",
      "description": "useRef, useCallback がインポートされているが未使用",
      "suggestion": "import { useState } from 'react'; のみにする"
    }
  ],
  "summary": "テーブル定義は設計書と完全に一致しており、Server Actionsの実装品質も高い。しかしロゴアップロードAPIに認証がないこと、SMTPパスワードがクライアントに漏洩していることの2つのcriticalなセキュリティ問題がある。これらを修正した上で再レビューが必要。"
}
```
