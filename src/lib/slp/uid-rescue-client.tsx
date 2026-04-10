"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredPublicUid, setPublicUid } from "./public-uid";

/**
 * サーバーコンポーネントの中継ページで、URL から uid が消えた場合に
 * sessionStorage から復元して URL に書き戻すクライアントコンポーネント
 *
 * 使い方:
 *   サーバーコンポーネント内にそのまま埋め込む
 *   → URLクエリに uid がある場合: sessionStorage に保存（次回以降のリロードに備える）
 *   → URLクエリに uid がない場合: sessionStorage から uid を取得 → URLを書き換えてリロード
 *   → sessionStorage にもない場合: 何もしない（サーバー側のエラー表示をそのまま見せる）
 */
export function UidRescueClient() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const urlUid = sp.get("uid")?.trim();

    if (urlUid) {
      // URL に uid がある → sessionStorage に保存（次回リロードに備える）
      setPublicUid(urlUid);
      return;
    }

    // URL に uid がない → sessionStorage から復元を試みる
    const stored = getStoredPublicUid();
    if (stored) {
      // URL を書き換えて再レンダリング
      const url = new URL(window.location.href);
      url.searchParams.set("uid", stored);
      router.replace(url.pathname + url.search);
    }
    // sessionStorage にもない場合は何もせず、サーバー側のエラー画面をそのまま表示
  }, [router]);

  return null;
}
