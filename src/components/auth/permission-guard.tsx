"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

/**
 * 権限変更を検知して自動ログアウトするガードコンポーネント。
 * SessionProviderのrefetchInterval（30秒）でセッションが定期的に更新され、
 * サーバー側のJWT callbackがDB権限との不一致を検知すると
 * permissionsExpiredフラグがセットされる。
 * このコンポーネントはそのフラグを監視し、検知時にsignOut()を呼ぶ。
 */
export function PermissionGuard() {
  const { data: session } = useSession();
  const signingOut = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((session as any)?.permissionsExpired && !signingOut.current) {
      signingOut.current = true;
      signOut({ callbackUrl: "/login?reason=permissions_changed" });
    }
  }, [session]);

  return null;
}
