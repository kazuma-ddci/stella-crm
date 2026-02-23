# Plan Review

## 総合評価

**B（軽微な修正後に実装可）**

`docs/claude-codex/claude-plan.md` は、`docs/claude-codex/codex-plan.md` のロードマップをかなり高い精度で具体化できています。  
特に Phase 2/3/4 の分解、STPスコープのサーバー検証維持、`prisma migrate dev` 前提の運用明記は良いです。

一方で、Phase 2/3 の実装前に補強した方がよい仕様・技術設計が残っています（P1あり）。  
このまま着手すると、候補判定の再検出ロジックや変動金額候補入力で手戻りが出る可能性があります。

## 良い点

- `codex-plan.md` の主要要件（Phase 2〜6 の方向性）は概ね反映されている
- 実装順序が妥当
  - Phase 2（候補判定）→ Phase 3（変動金額）→ Phase 4（SystemProjectBinding）
- STPスコープのサーバー検証維持が明記されている（UI依存に戻っていない）
- `prisma db push` 禁止が明記され、`prisma migrate dev --name <変更内容>` 前提になっている
- Phase 2 に `targetMonth` バリデーション、`sourceFingerprint`、N+1回避、`upsert` が追加されており、前回より設計の質が上がっている
- Phase 3 に責務分離（候補画面 vs 取引管理）と一括取引化との整合ルールが入っている
- Phase 4 に `routeKey` 不変性、`defaultCostCenterId` 整合性、`isActive`、キャッシュ方針が入っている
- Phase 5 / 6 をサブフェーズに分割しており、実装スコープの暴走を抑える方向になっている

## 指摘事項

### P1（必須修正）

- **Phase 3 の候補画面簡易入力項目が `codex-plan.md` の要件を一部落としている**
  - `codex-plan.md` では Phase 3 の簡易入力に「期日/予定日の一部」が含まれているが、`claude-plan.md` の 3-1 は金額・税率・税額・メモのみ
  - 仕様差分として明示的に「今回は除外」するか、簡易入力に `入金/支払の期日 or 予定日` の最低1項目を入れるかを決める必要がある
  - 要件網羅性の観点で現状は未充足

- **`acknowledgeReview()` が `newFingerprint` を引数で受ける設計は、技術的に不正確/危険**
  - フィンガープリントはサーバー側で現行ソースから再計算すべきで、クライアント入力値を信頼すると整合性が崩れる
  - `acknowledgeReview(candidateKey, targetMonth)` にして、サーバー側で再計算・保存する設計に変更した方がよい

- **Phase 2 の候補判定テーブルに、将来の複数プロジェクト展開を見据えたスコープ列（例: routeKey / projectCode）を検討した方がよい**
  - `codex-plan.md` には Phase 4/5 で複数プロジェクト展開の前提がある
  - `@@unique([candidateKey, targetMonth])` だけだと、将来 `/srd` などを導入した際に衝突/意味不明な共有状態になる可能性がある
  - 今回 STP専用で割り切るなら、その制約を plan に明記（「Phase 2 は STP専用。複数PJ対応時に migration 予定」）が必要

### P2（推奨）

- **`needsReview` の判定根拠（fingerprint構成）を候補タイプごとにもう少し厳密化した方がよい**
  - 現状の例示（`contractId + amount + startDate + endDate` 等）は方向性として良い
  - ただし、税区分/課税区分/取引先/対象月/契約状態変更など、再判定に影響する属性の洗い出しを先にしておくと手戻りが減る

- **Phase 2 のサーバーアクション一覧に `saveOverrideValues()`（Phase 3）との責務境界をコメント追加した方がよい**
  - 今の plan でも大筋は明確だが、`decideCandidateAction()` と `saveOverrideValues()` の実行順・依存関係を明記すると実装がぶれにくい
  - 例: `override` 保存は `pending/held` 状態でのみ許可、`converted` 後は不可など

- **Phase 3 の税額計算ルールは既存会計ロジックと丸め方法を揃えることを明記した方がよい**
  - `Math.floor()` が plan に書かれているが、既存の税額計算（四捨五入/切り上げ/切り捨て）とズレる可能性がある
  - 既存 `transaction-form` / 会計側の税計算ルールに合わせる方針を追記推奨

- **受け入れ条件にサーバー側バリデーションの明示確認を追加した方がよい（Phase 3）**
  - Phase 3 は UI だけでなく server action 側拒否が重要
  - 例: DevTools で override 未入力候補を無理に送っても取引化拒否されること

- **`codex-plan.md` の「変更点のドキュメント更新（STP向け操作フロー）」が `claude-plan.md` の横断タスクから落ちている**
  - 実装が積み上がるほど利用側の手順書差分が増えるため、横断タスクに復活推奨

- **Phase 5 の受け入れ条件がサブフェーズ分割に対してまだ粗い**
  - 5-1〜5-4 に分割したなら、各サブフェーズごとに最小受け入れ条件を置くと実装判定しやすい

### P3（任意）

- **`status` / `reasonType` を Prisma enum にするか、String + Zod のままにするか方針を明記するとよい**
  - 現状は String でも実装可能
  - 将来の変更頻度が高いなら String + Zod、安定運用を狙うなら enum の検討余地あり

- **クライアント実装時のソートに関する注意を追記すると安全**
  - 制約として「日本語文字列の `localeCompare` をクライアントコンポーネントで使用禁止」がある
  - Phase 2 のフィルタUI / Phase 6 の候補表示で日本語ラベルソートが必要になった場合、サーバー側で順序を決める方針を明記すると事故を防げる

- **Phase 6 の 6-3（おすすめグループ案）に着手条件を追加するとよい**
  - 例: 6-1/6-2 の運用結果で作成回数・エラー率を見てから着手

## 実装判定

**修正後に再レビュー**

対象:
- まず `Phase 2 / Phase 3` の P1項目を plan に反映
- その後、`Phase 2` から着手するのが妥当

