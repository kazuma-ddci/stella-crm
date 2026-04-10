"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { KoutekiPageShell } from "@/components/kouteki";

type ViewerData = {
  authorized: true;
  uid: string;
  snsname: string;
};

export default function SlpVideoPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [errorReason, setErrorReason] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 認証チェック
  // 初回: URL クエリ (?uid=xxx&snsname=yyy) で認証 → Cookie 発行 → URL からクエリ削除
  // リロード・2回目以降: Cookie（1時間有効）で再認証
  useEffect(() => {
    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("uid");
      const snsname = params.get("snsname");

      // URL クエリがあれば初回認証、なければ Cookie での再認証を試みる
      const apiUrl =
        uid && snsname
          ? `/api/public/slp/video-access?uid=${encodeURIComponent(uid)}&snsname=${encodeURIComponent(snsname)}`
          : `/api/public/slp/video-access`;

      try {
        const res = await fetch(apiUrl, {
          credentials: "include", // Cookie の送受信
        });
        const data = await res.json();
        if (data.authorized) {
          setAuthorized(true);
          setViewerData({
            authorized: true,
            uid: data.uid,
            snsname: data.snsname,
          });
          // video URL は Cookie 認証で動作するので、クエリパラメータ不要
          setVideoUrl(`/api/public/slp/video-access?type=video`);
          // URL 欄からパラメータを削除
          if (uid && snsname) {
            window.history.replaceState({}, "", "/form/slp-video");
          }
        } else {
          setErrorReason(data.reason || "not_authorized");
        }
      } catch {
        setErrorReason("error");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // ローディング
  if (loading) {
    return (
      <KoutekiPageShell title="動画閲覧ページ">
        <div className="py-16 text-center text-sm text-slate-500">
          読み込み中...
        </div>
      </KoutekiPageShell>
    );
  }

  // 権限なし
  if (!authorized || !viewerData) {
    return (
      <KoutekiPageShell title="動画閲覧ページ">
        <div className="space-y-5 text-center">
          <div className="flex justify-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
              <ShieldAlert className="h-8 w-8 text-rose-500" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            閲覧権限がありません
          </h2>
          <p className="text-sm text-slate-600">
            {errorReason === "missing_params"
              ? "アクセスURLが正しくありません。"
              : "この動画を閲覧する権限がありません。"}
          </p>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-left">
            <p className="mb-1 text-sm font-semibold text-emerald-800">
              お問い合わせ
            </p>
            <p className="text-sm text-emerald-700">
              詳しくは公式LINEへお問い合わせください。
            </p>
          </div>
        </div>
      </KoutekiPageShell>
    );
  }

  // ウォーターマークテキスト
  const watermarkText = `スクリーンショット禁止 ${viewerData.snsname} ${viewerData.uid}`;

  return (
    <div ref={containerRef} className="flex min-h-screen select-none flex-col bg-black">
      {/* 動画コンテナ */}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="relative w-full max-w-4xl">
          <video
            src={videoUrl}
            controls
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            className="h-auto w-full rounded-lg bg-black shadow-2xl"
          >
            お使いのブラウザは動画再生に対応していません。
          </video>

          {/* ウォーターマーク: 斜め繰り返し（操作を妨げない） */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
            style={{ zIndex: 10 }}
          >
            <div
              className="absolute"
              style={{
                top: "-50%",
                left: "-50%",
                width: "200%",
                height: "200%",
                transform: "rotate(-30deg)",
                display: "flex",
                flexWrap: "wrap",
                alignContent: "center",
                justifyContent: "center",
                gap: "60px 80px",
              }}
            >
              {Array(30)
                .fill(null)
                .map((_, j) => (
                  <span
                    key={j}
                    className="whitespace-nowrap font-medium"
                    style={{
                      fontSize: "14px",
                      color: "#ffffff",
                      opacity: 0.18,
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      textShadow: "0 0 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    {watermarkText}
                  </span>
                ))}
            </div>
          </div>

          {/* 識別ID（右上固定） */}
          <div
            className="pointer-events-none absolute top-2 right-2"
            style={{ zIndex: 11 }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "#ffffff",
                opacity: 0.5,
                userSelect: "none",
                WebkitUserSelect: "none",
                textShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            >
              {viewerData.uid}
            </span>
          </div>
        </div>
      </div>

      {/* 右クリック防止・選択防止 */}
      <style jsx global>{`
        body {
          -webkit-user-select: none;
          user-select: none;
          background: #000;
        }
        video::-webkit-media-controls-download-button {
          display: none !important;
        }
        video::-webkit-media-controls-enclosure {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
