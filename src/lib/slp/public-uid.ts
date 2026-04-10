/**
 * SLP 公開フォーム・中継ページで使用する uid 取得ユーティリティ
 *
 * 問題:
 *   リッチメニューから `?uid=xxx` 付きでアクセスした後、ページ内のリロードや
 *   SPA遷移で URL から `?uid=xxx` が消えてしまうと、「公式LINEから再度アクセス
 *   してください」エラーになってしまう。
 *
 * 解決:
 *   uid を **sessionStorage** にも保存しておき、URL から消えても復元できる
 *   ようにする。sessionStorage はタブごとに分離されているので、別ユーザーの
 *   データが混ざる心配はない（タブを閉じると消える）。
 */

const STORAGE_KEY = "slp-public-uid";

/**
 * URL クエリまたは sessionStorage から uid を取得する
 *
 * 動作:
 *   1. URL に `?uid=xxx` があればそれを優先し、sessionStorage にも保存して返す
 *   2. URL に uid がなければ sessionStorage から復元して返す
 *   3. どちらにもなければ null を返す
 *
 * @returns uid（文字列）または null
 */
export function getPublicUid(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const sp = new URLSearchParams(window.location.search);
    const urlUid = sp.get("uid")?.trim();

    if (urlUid) {
      // URL に uid がある → sessionStorage にも保存
      try {
        window.sessionStorage.setItem(STORAGE_KEY, urlUid);
      } catch {
        // sessionStorage が使えない環境（プライベートブラウズ等）は無視
      }
      return urlUid;
    }

    // URL に uid がない → sessionStorage から復元
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      const trimmed = stored?.trim();
      return trimmed && trimmed !== "" ? trimmed : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * sessionStorage から uid を取得のみ行う（URL を見ない）
 * サーバーコンポーネントで uid がない時にクライアント側で復元するための関数
 */
export function getStoredPublicUid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    const trimmed = stored?.trim();
    return trimmed && trimmed !== "" ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * uid を明示的に sessionStorage に保存する
 */
export function setPublicUid(uid: string): void {
  if (typeof window === "undefined") return;
  if (!uid.trim()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, uid.trim());
  } catch {
    // ignore
  }
}

/**
 * sessionStorage の uid をクリアする（明示的なログアウト時などに使用）
 */
export function clearPublicUid(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
