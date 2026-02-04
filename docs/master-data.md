# マスタデータ

このドキュメントはstella-crmの初期データと選択肢定義を記述したものです。

---

## 目次

1. [初期データ](#初期データ)
   - [stp_stages（商談ステージ）](#stp_stages商談ステージ)
   - [contact_methods（接触方法）](#contact_methods接触方法---全プロジェクト共通)
   - [stp_lead_sources（流入経路）](#stp_lead_sources流入経路)
   - [stp_communication_methods（連絡方法）](#stp_communication_methods連絡方法---企業との連絡方法)
   - [display_views（表示ビュー）](#display_views表示ビュー)
2. [選択肢定義](#選択肢定義)

---

## 初期データ

### stp_stages（商談ステージ）

| id | name | display_order | 分類 |
|----|------|---------------|------|
| 1 | リード | 1 | 進行ステージ |
| 2 | 商談化 | 2 | 進行ステージ |
| 3 | 提案中 | 3 | 進行ステージ |
| 4 | 見積提示 | 4 | 進行ステージ |
| 5 | 受注 | 5 | 終了ステージ |
| 6 | 失注 | 6 | 終了ステージ |
| 7 | 検討中 | 7 | 保留ステージ |

**注意：** 失注（6）、検討中（7）は目標に設定不可

---

### contact_methods（接触方法 - 全プロジェクト共通）

| id | name | display_order |
|----|------|---------------|
| 1 | 電話 | 1 |
| 2 | メール | 2 |
| 3 | 訪問 | 3 |
| 4 | Web会議 | 4 |
| 5 | その他 | 5 |

---

### stp_lead_sources（流入経路）

| id | name | display_order |
|----|------|---------------|
| 1 | 流入経路1 | 1 |
| 2 | 流入経路2 | 2 |
| 3 | 流入経路3 | 3 |
| 4 | 流入経路4 | 4 |
| 5 | 流入経路5 | 5 |

---

### stp_communication_methods（連絡方法 - 企業との連絡方法）

| id | name | display_order |
|----|------|---------------|
| 1 | 連絡方法1 | 1 |
| 2 | 連絡方法2 | 2 |
| 3 | 連絡方法3 | 3 |
| 4 | 連絡方法4 | 4 |
| 5 | 連絡方法5 | 5 |

---

### display_views（表示ビュー）

| viewKey | viewName | projectCode |
|---------|----------|-------------|
| stp_client | 採用ブースト（クライアント版） | stp |
| stp_agent | 採用ブースト（代理店版） | stp |

---

## 選択肢定義

```typescript
// ヨミ（forecast）
const FORECASTS = ['MIN', '落とし', 'MAX', '来月', '辞退'] as const;

// 運用ステータス（operationStatus）
const OPERATION_STATUSES = ['テスト1', 'テスト2'] as const;

// 業種区分（industryType）
const INDUSTRY_TYPES = ['一般', '派遣'] as const;

// 初期費用（initialFee）
const INITIAL_FEES = [0, 100000, 150000] as const;

// 担当運用（operationStaffList）
const OPERATION_STAFF_OPTIONS = ['indeed', '運用2'] as const;

// イベント種別（eventType）
const EVENT_TYPES = ['commit', 'achieved', 'recommit', 'progress', 'back', 'cancel'] as const;

// 企業契約書ステータス（stp_company_contracts.status）
const CONTRACT_STATUSES = ['draft', '送付済み', '先方情報待ち', 'signed', 'expired'] as const;

// 外部ユーザーステータス（external_users.status）
const USER_STATUSES = ['pending_email', 'pending_approval', 'active', 'suspended'] as const;

// 登録トークンステータス（registration_tokens.status）
const TOKEN_STATUSES = ['active', 'expired', 'exhausted', 'revoked'] as const;

// リード獲得フォーム回答ステータス（stp_lead_form_submissions.status）
const SUBMISSION_STATUSES = ['pending', 'processed', 'rejected'] as const;
```
