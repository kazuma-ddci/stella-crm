"use client";

import { useEffect } from "react";

/**
 * 未保存変更がある間、ブラウザのリロード／タブ閉じ／URL直打ちを警告する。
 * App Router の内部遷移（router.push）までは傍受しない。
 * 「一覧に戻る」などの内部リンクは呼び出し側で confirm を出すこと。
 */
export function useNavigationGuard(active: boolean, message = "保存前のデータがあります。破棄してページを離れますか？") {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome/Firefox 用の returnValue 設定（表示される文言はブラウザ依存）
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active, message]);
}

/**
 * 未保存変更があるときに内部リンクをクリックされたら確認ダイアログを出す。
 * クリックハンドラとしてそのまま使える。
 */
export function createInternalLinkGuard(active: boolean, message = "保存前のデータがあります。破棄してページを離れますか？") {
  return (e: React.MouseEvent) => {
    if (!active) return;
    if (!window.confirm(message)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}
