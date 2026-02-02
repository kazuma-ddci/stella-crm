# 接触履歴（Contact History）ロジック仕様書

## 概要

接触履歴は、STP企業および代理店との接触記録を管理する機能です。1つのテーブル（`stp_contact_histories`）で企業接触と代理店接触の両方を管理し、`stpCompanyId`と`agentId`の排他性により論理的に分離しています。

---

## 1. データ構造

### 1.1 StpContactHistory テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Int | 主キー（自動採番） |
| stpCompanyId | Int? | STP企業への外部キー（企業接触の場合） |
| agentId | Int? | 代理店への外部キー（代理店接触の場合） |
| contactDate | DateTime | 接触日時（必須） |
| contactMethodId | Int? | 接触方法（マスタへの外部キー） |
| assignedTo | String? | 担当者（スタッフIDをカンマ区切りで保存） |
| customerParticipants | String? | 先方参加者（最大500字） |
| meetingMinutes | String? | 議事録 |
| note | String? | 備考 |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |
| deletedAt | DateTime? | 論理削除日時 |

**ポイント:**
- `stpCompanyId`と`agentId`は**排他的**（どちらか一方のみが値を持つ）
- `deletedAt`による**論理削除**を採用

### 1.2 StpContactMethod テーブル（接触方法マスタ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Int | 主キー |
| name | String | 接触方法名 |
| displayOrder | Int | 表示順 |
| isActive | Boolean | 有効フラグ |

**初期データ:**

| id | name | display_order |
|----|------|---------------|
| 1 | 電話 | 1 |
| 2 | メール | 2 |
| 3 | 訪問 | 3 |
| 4 | Web会議 | 4 |
| 5 | その他 | 5 |

---

## 2. 企業接触と代理店接触の違い

| 項目 | 企業接触履歴 | 代理店接触履歴 |
|------|------------|--------------|
| **テーブル内識別** | `stpCompanyId != null, agentId = null` | `agentId != null, stpCompanyId = null` |
| **親テーブル** | StpCompany（STP企業） | StpAgent（代理店） |
| **一覧画面パス** | `/stp/records/company-contacts` | `/stp/records/agent-contacts` |
| **編集方法** | STP企業一覧のモーダル or 一覧画面 | 代理店一覧のモーダル or 一覧画面 |
| **Actionsファイル** | `contact-history-actions.ts` | `contact-history-actions.ts` |

---

## 3. CRUD操作

### 3.1 Create（新規作成）

**企業接触履歴:**
```typescript
// src/app/stp/companies/contact-history-actions.ts
export async function addCompanyContactHistory(
  stpCompanyId: number,
  data: {
    contactDate?: string;
    contactMethodId?: number | null;
    assignedTo?: string | null;        // カンマ区切りのスタッフID
    customerParticipants?: string | null;
    meetingMinutes?: string | null;
    note?: string | null;
  }
)
```

**代理店接触履歴:**
```typescript
// src/app/stp/agents/contact-history-actions.ts
export async function addAgentContactHistory(
  agentId: number,
  data: { ... }  // 同じ構造
)
```

### 3.2 Update（更新）

```typescript
export async function updateCompanyContactHistory(id: number, data: ContactHistoryInput)
export async function updateAgentContactHistory(id: number, data: ContactHistoryInput)
```

### 3.3 Delete（論理削除）

```typescript
export async function deleteCompanyContactHistory(id: number) {
  await prisma.stpContactHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

**注意:** 物理削除ではなく`deletedAt`をセットする論理削除

---

## 4. UI構成

### 4.1 画面一覧

| パス | 画面 | 機能 |
|------|------|------|
| `/stp/companies` | STP企業一覧 | モーダルから接触履歴管理 |
| `/stp/agents` | 代理店一覧 | モーダルから接触履歴管理 |
| `/stp/records/company-contacts` | 企業接触履歴一覧 | CRUD操作 |
| `/stp/records/agent-contacts` | 代理店接触履歴一覧 | CRUD操作 |
| `/companies/[id]` | 全顧客詳細 | 接触履歴表示（読み取り専用） |

### 4.2 モーダルコンポーネント

**CompanyContactHistoryModal** (`/src/app/stp/companies/contact-history-modal.tsx`)

**Props:**
```typescript
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stpCompanyId: number;
  companyName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
};
```

**機能:**
- 接触履歴一覧表示（日付降順）
- 新規追加フォーム
- 編集フォーム（確認ダイアログ付き）
- 削除確認ダイアログ

**フォーム項目:**
| 項目 | 入力方法 | 必須 |
|------|---------|------|
| 接触日時 | DatePicker（15分間隔） | ○ |
| 接触方法 | セレクトボックス | - |
| 担当者 | 複数選択（Combobox） | - |
| 先方参加者 | テキスト入力 | - |
| 議事録 | テキストエリア（4行） | - |
| 備考 | テキストエリア（2行） | - |

### 4.3 一覧画面のテーブル列

| 列 | 編集可否 |
|----|---------|
| ID | × |
| 企業/代理店 | ○（セレクト） |
| 企業名/代理店名 | × |
| 接触日時 | ○ |
| 接触方法 | ○（セレクト） |
| 担当者 | ○ |
| 議事録 | ○ |
| 備考 | ○ |
| 作成日 | × |
| 更新日 | × |

---

## 5. 担当者の複数選択ロジック

担当者（`assignedTo`）は複数のスタッフIDをカンマ区切りで保存します。

### 5.1 保存形式

```
"1,3,5"  // スタッフID 1, 3, 5 が担当
```

### 5.2 選択/解除ロジック

```typescript
const handleStaffChange = (staffId: string) => {
  const currentIds = (formData.assignedTo || "").split(",").filter(Boolean);
  const isSelected = currentIds.includes(staffId);

  let newIds: string[];
  if (isSelected) {
    // 選択解除
    newIds = currentIds.filter((id) => id !== staffId);
  } else {
    // 追加選択
    newIds = [...currentIds, staffId];
  }

  setFormData({ ...formData, assignedTo: newIds.join(",") });
};
```

### 5.3 表示変換

```typescript
// IDを名前に変換
const assignedNames = (assignedTo || "")
  .split(",")
  .filter(Boolean)
  .map((id) => staffMap[id]?.name || id)
  .join(", ");
```

---

## 6. データフロー

### 6.1 企業接触履歴のフロー

```
┌─────────────────────────────┐
│ /stp/companies              │
│ (STP企業一覧)               │
└────────────┬────────────────┘
             │ モーダルボタン
             ▼
┌─────────────────────────────┐
│ CompanyContactHistoryModal  │
│ - 一覧表示                   │
│ - 新規追加                   │
│ - 編集                       │
│ - 削除(論理削除)             │
└────────────┬────────────────┘
             │ Server Action
             ▼
┌─────────────────────────────┐
│ contact-history-actions.ts  │
│ - addCompanyContactHistory   │
│ - updateCompanyContactHistory│
│ - deleteCompanyContactHistory│
└────────────┬────────────────┘
             │ Prisma
             ▼
┌─────────────────────────────┐
│ stp_contact_histories       │
│ (stpCompanyId != null)      │
└────────────┬────────────────┘
             │ revalidatePath
             ▼
┌─────────────────────────────┐
│ /stp/records/company-contacts│
│ (一覧画面に反映)             │
└─────────────────────────────┘
```

### 6.2 代理店接触履歴のフロー

企業と同じ構造で、`agentId != null, stpCompanyId = null`

---

## 7. クエリパターン

### 7.1 企業接触履歴の取得

```typescript
const contacts = await prisma.stpContactHistory.findMany({
  where: {
    stpCompanyId: { not: null },  // 企業接触のみ
    deletedAt: null,               // 削除済みを除外
  },
  include: {
    stpCompany: { include: { company: true } },
    contactMethod: true,
  },
  orderBy: { contactDate: "desc" },
});
```

### 7.2 代理店接触履歴の取得

```typescript
const contacts = await prisma.stpContactHistory.findMany({
  where: {
    agentId: { not: null },        // 代理店接触のみ
    deletedAt: null,
  },
  include: {
    agent: { include: { company: true } },
    contactMethod: true,
  },
  orderBy: { contactDate: "desc" },
});
```

### 7.3 接触方法マスタの取得

```typescript
const contactMethods = await prisma.stpContactMethod.findMany({
  where: { isActive: true },
  orderBy: { displayOrder: "asc" },
});
```

---

## 8. バリデーション・制約

### 8.1 必須項目

| 項目 | 新規作成 | 編集 |
|------|---------|------|
| 接触日時 | 必須 | 必須 |
| 企業/代理店 | 必須 | 変更不可 |

### 8.2 データ型制約

| カラム | 制約 |
|--------|------|
| assignedTo | VARCHAR(255)、カンマ区切りID |
| customerParticipants | VARCHAR(500) |
| meetingMinutes | TEXT（制限なし） |
| note | TEXT（制限なし） |

### 8.3 論理削除

- 削除操作は`deletedAt`に現在日時をセット
- 一覧表示時は`deletedAt: null`でフィルタ
- 物理削除は行わない

---

## 9. キャッシュ無効化

Server Action実行後、関連パスのキャッシュを無効化します。

### 企業接触履歴

```typescript
revalidatePath("/stp/companies");
revalidatePath("/stp/records/company-contacts");
```

### 代理店接触履歴

```typescript
revalidatePath("/stp/agents");
revalidatePath("/stp/records/agent-contacts");
```

---

## 10. エンティティ関連図

```
MasterStellaCompany (全顧客マスタ)
    │
    ├─ 1:N → StpCompany (STP企業)
    │           │
    │           └─ 1:N → StpContactHistory
    │                      └─ N:1 → StpContactMethod
    │
    └─ 1:N → StpAgent (代理店)
                │
                ├─ 1:N → StpContactHistory
                │          └─ N:1 → StpContactMethod
                │
                └─ N:N → MasterStaff (via StpAgentStaff)

MasterStaff (スタッフマスタ)
    └─ 接触履歴.assignedTo で参照（カンマ区切りID）
```

---

## 11. ファイル構成

```
src/
├── app/
│   └── stp/
│       ├── companies/
│       │   ├── contact-history-actions.ts   # 企業接触履歴CRUD
│       │   └── contact-history-modal.tsx    # 企業接触履歴モーダル
│       ├── agents/
│       │   ├── contact-history-actions.ts   # 代理店接触履歴CRUD
│       │   └── contact-history-modal.tsx    # 代理店接触履歴モーダル
│       └── records/
│           ├── company-contacts/
│           │   ├── page.tsx                 # 企業接触履歴一覧ページ
│           │   └── actions.ts               # 一覧画面用CRUD
│           └── agent-contacts/
│               ├── page.tsx                 # 代理店接触履歴一覧ページ
│               └── actions.ts               # 一覧画面用CRUD
└── components/
    └── companies/[id]/
        └── contact-history-section.tsx      # 全顧客詳細の接触履歴表示
```

---

## 12. 機能サマリー

| 機能 | 企業接触履歴 | 代理店接触履歴 | 全顧客詳細画面 |
|------|-----------|-------------|-------------|
| 新規登録 | ○ | ○ | - |
| 編集 | ○ | ○ | - |
| 削除 | ○（論理削除） | ○（論理削除） | - |
| 表示 | ○ | ○ | ○（読み取り専用） |
| 複数担当者 | ○ | ○ | ○ |
| 接触方法選択 | ○ | ○ | ○ |
| 議事録入力 | ○ | ○ | ○ |
| 先方参加者入力 | ○ | ○ | ○ |

---

## 13. 注意事項

1. **排他的関係**: `stpCompanyId`と`agentId`は必ずどちらか一方のみ値を持つ
2. **論理削除**: 物理削除ではなく`deletedAt`フラグを使用
3. **担当者形式**: 複数スタッフIDをカンマ区切りで保存（例: `"1,3,5"`）
4. **日時形式**: DateTimeで秒単位まで保存、表示は日本時間
5. **マスタ参照**: 接触方法は`isActive = true`のレコードのみ表示
