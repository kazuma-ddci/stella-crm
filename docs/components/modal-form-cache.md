# モーダルのフォームステートキャッシュ

## 背景

モーダルでデータ入力後、保存やキャンセルを押さずに背景クリックで閉じると、次に別の企業/代理店のモーダルを開いた際に前の入力内容が残り、誤ったデータが気づかず保存されるリスクがあった。

単純にopen時に毎回リセットする方法では、同じ企業のモーダルを再度開いた際に入力途中のデータが失われるため、エンティティ別・10分TTLのキャッシュを導入した。

## 仕組み

### 共通hook: `src/hooks/use-timed-form-cache.ts`

モジュールレベルの `Map` でフォームデータをキャッシュする。

```typescript
const { restore, save, clear } = useTimedFormCache<CachedState>(`cache-key-${entityId}`);
```

- **`restore()`**: キャッシュがあり10分以内なら返す、なければ `null`
- **`save(data)`**: キャッシュに保存（タイムスタンプ付き）
- **`clear()`**: キャッシュを削除

### 各モーダルでの使用パターン

```typescript
// 1. キャッシュするステート型を定義
type CachedState = {
  formData: Partial<SomeType>;
  isAddMode: boolean;
  editHistory: SomeType | null;
};

// 2. hookとrefを設定
const { restore, save, clear } = useTimedFormCache<CachedState>(`modal-name-${entityId}`);
const formStateRef = useRef<CachedState>({ ... });
formStateRef.current = { formData, isAddMode, editHistory };

// 3. クローズ時にキャッシュ保存（cleanup関数を利用）
useEffect(() => {
  if (!open) return;
  return () => {
    save(formStateRef.current);
  };
}, [open, save]);

// 4. オープン時にキャッシュ復元 or リセット
useEffect(() => {
  if (open) {
    loadData();
    const cached = restore();
    if (cached) {
      setFormData(cached.formData);
      setIsAddMode(cached.isAddMode);
      setEditHistory(cached.editHistory);
    } else {
      setFormData({});
      setIsAddMode(false);
      setEditHistory(null);
    }
    // 確認ダイアログ等の一時的UI状態は常にリセット
    setDeleteConfirm(null);
    setEditConfirm(false);
  }
}, [open, loadData, restore]);
```

## 動作

| 操作 | 結果 |
|------|------|
| A社モーダル → 入力 → 背景クリック → A社再度開く（10分以内） | 前回の入力が復元 |
| A社モーダル閉じる → B社を開く | B社は空の状態 |
| A社閉じてから10分以上経過 → A社を開く | 空の状態（TTL切れ） |
| 入力 → 保存成功 → フォームリセット → 閉じる → 再度開く | 空の状態 |
| ページ遷移・リロード | キャッシュはクリアされる（メモリ上） |

## キャッシュ対象の判断基準

| キャッシュする | キャッシュしない（常にリセット） |
|--------------|-------------------------------|
| `formData`（ユーザー入力） | `deleteConfirm`（削除確認ダイアログ） |
| `isAddMode`（追加モード中か） | `editConfirm`（編集確認ダイアログ） |
| `editHistory`/`editContract`（編集対象） | `pendingEditData`（一時的な確認待ちデータ） |
| `formOpen`（フォーム表示中か） | `financeWarning`（警告表示） |
| `isManualMonthlyFee` 等（フォーム設定） | `staffPopoverOpen`（UIポップオーバー状態） |

## 適用済みモーダル

| ファイル | キャッシュキー |
|---------|-------------|
| `companies/contract-history-modal.tsx` | `company-contract-history-${companyId}` |
| `agents/agent-contract-history-modal.tsx` | `agent-contract-history-${agentId}` |
| `components/proposal-modal.tsx` | `proposal-${stpCompanyId}` |
| `components/master-contract-modal.tsx` | `master-contract-${companyId}` |
| `finance/payments/allocation-modal.tsx` | `allocation-${transactionId}` |
| `agents/contact-history-modal.tsx` | `agent-contact-history-${agentId}` |
| `companies/contact-history-modal.tsx` | `company-contact-history-${stpCompanyId}` |
| `agents/contracts-modal.tsx` | `agent-contracts-${agentId}` |

## 新規モーダル追加時の注意

新しいモーダルを作る場合はこのパターンに従う：
1. `useTimedFormCache` をimport
2. キャッシュキーにはモーダル種別 + エンティティIDを含める
3. `formStateRef` で毎レンダーの最新stateを追跡
4. save-on-close useEffect と restore-on-open ロジックを追加
5. 一時的なUI状態（確認ダイアログ等）は常にリセット

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-19 | 初版作成（8モーダルに適用） |
