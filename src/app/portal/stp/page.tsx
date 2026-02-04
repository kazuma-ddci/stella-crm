"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PortalStpPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any;
    const displayViews = user?.displayViews ?? [];

    // 利用可能なビューに応じてリダイレクト
    const hasClientView = displayViews.some(
      (v: { viewKey: string }) => v.viewKey === "stp_client"
    );
    const hasAgentView = displayViews.some(
      (v: { viewKey: string }) => v.viewKey === "stp_agent"
    );

    if (hasClientView) {
      router.replace("/portal/stp/client");
    } else if (hasAgentView) {
      router.replace("/portal/stp/agent");
    } else {
      router.replace("/portal");
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  );
}
