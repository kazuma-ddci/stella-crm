"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5分ごとにチェック

export function BuildVersionChecker() {
  const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
  const hasReloaded = useRef(false);

  useEffect(() => {
    if (!currentBuildId) return;

    const checkVersion = async () => {
      try {
        const res = await fetch("/api/build-id", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId: serverBuildId } = await res.json();
        if (serverBuildId && serverBuildId !== currentBuildId && !hasReloaded.current) {
          hasReloaded.current = true;
          window.location.reload();
        }
      } catch {
        // ネットワークエラー時は無視
      }
    };

    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [currentBuildId]);

  return null;
}
