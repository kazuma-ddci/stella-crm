"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";

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
  useEffect(() => {
    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("uid");
      const snsname = params.get("snsname");

      if (!uid || !snsname) {
        setErrorReason("missing_params");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/public/slp/video-access?uid=${encodeURIComponent(uid)}&snsname=${encodeURIComponent(snsname)}`
        );
        const data = await res.json();
        if (data.authorized) {
          setAuthorized(true);
          setViewerData({ authorized: true, uid: data.uid, snsname: data.snsname });
          setVideoUrl(
            `/api/public/slp/video-access?uid=${encodeURIComponent(uid)}&snsname=${encodeURIComponent(snsname)}&type=video`
          );
          // URL欄からパラメータを削除
          window.history.replaceState({}, "", "/form/slp-video");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  // 権限なし
  if (!authorized || !viewerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            閲覧権限がありません
          </h1>
          <p className="text-gray-600 mb-6">
            {errorReason === "missing_params"
              ? "アクセスURLが正しくありません。"
              : "この動画を閲覧する権限がありません。"}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-medium mb-1">
              お問い合わせ
            </p>
            <p className="text-sm text-green-700">
              詳しくは公式LINEへお問い合わせください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ウォーターマークテキスト
  const watermarkText = `スクリーンショット禁止 ${viewerData.snsname} ${viewerData.uid}`;

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-black select-none">
      {/* 動画コンテナ */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl">
          <video
            src={videoUrl}
            controls
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-auto rounded-lg shadow-2xl bg-black"
          >
            お使いのブラウザは動画再生に対応していません。
          </video>

          {/* ウォーターマーク: 斜め繰り返し（操作を妨げない） */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg"
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
                    className="font-medium whitespace-nowrap"
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
            className="absolute top-2 right-2 pointer-events-none"
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
