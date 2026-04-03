"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";

const ReactPdfDocument = dynamic(
  () =>
    import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return { default: mod.Document };
    }),
  { ssr: false }
);
const ReactPdfPage = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Page })),
  { ssr: false }
);

type ViewerData = {
  authorized: true;
  name: string;
  email: string;
  watermarkCode: string;
  viewedAt: string;
};

export default function SlpDocumentPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [errorReason, setErrorReason] = useState<string>("");

  // PDF viewer state
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("uid");

      if (!uid) {
        setErrorReason("no_uid");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/public/slp/document-access?uid=${encodeURIComponent(uid)}`);
        const data = await res.json();
        if (data.authorized) {
          setAuthorized(true);
          setViewerData(data);
          setPdfUrl(`/api/public/slp/document-access?uid=${encodeURIComponent(uid)}&type=pdf`);
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

  // コンテナ幅監視
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
    },
    []
  );

  const fitWidth = Math.max(containerWidth - 32, 300);
  const pageWidth = fitWidth * zoom;

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
            {errorReason === "no_uid"
              ? "アクセスURLが正しくありません。"
              : "この資料を閲覧するには組合員契約の締結が必要です。"}
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

  // ウォーターマークテキスト生成
  const watermarkMainText = `スクリーンショット禁止 ${viewerData.name} ${viewerData.email || ""}`;

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-gray-100 select-none">
      {/* ツールバー */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white shrink-0 z-50">
        <span className="text-xs text-gray-600">
          {numPages ? `${numPages}ページ` : "読み込み中..."}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={zoom <= 0.5}
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-600 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={zoom >= 3}
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDFビューア（縦スクロール） */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="flex flex-col items-center py-4 gap-4">
          <ReactPdfDocument
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                PDF読み込み中...
              </div>
            }
            error={
              <div className="flex items-center justify-center h-40 text-red-400 text-sm">
                PDFの読み込みに失敗しました
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} className="relative shadow-lg mb-4">
                <ReactPdfPage
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />

                {/* ウォーターマーク: メインテキスト（斜め繰り返し） */}
                <div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{ zIndex: 10 }}
                  onContextMenu={(e) => e.preventDefault()}
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
                          className="text-gray-500 font-medium whitespace-nowrap"
                          style={{
                            fontSize: "14px",
                            opacity: 0.12,
                            userSelect: "none",
                            WebkitUserSelect: "none",
                          }}
                        >
                          {watermarkMainText}
                        </span>
                      ))}
                  </div>
                </div>

                {/* ウォーターマーク: ハッシュID（右下固定） */}
                <div
                  className="absolute bottom-2 right-2 pointer-events-none"
                  style={{ zIndex: 11 }}
                >
                  <span
                    className="text-gray-400 font-mono"
                    style={{
                      fontSize: "10px",
                      opacity: 0.3,
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  >
                    {viewerData.watermarkCode}
                  </span>
                </div>
              </div>
            ))}
          </ReactPdfDocument>
        </div>
      </div>

      {/* 右クリック防止 */}
      <style jsx global>{`
        body {
          -webkit-user-select: none;
          user-select: none;
        }
        img, canvas {
          -webkit-user-drag: none;
          user-drag: none;
        }
      `}</style>
    </div>
  );
}
