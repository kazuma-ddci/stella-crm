"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// react-pdf を動的にインポート（SSRでDOMMatrix未定義エラー回避）
import dynamic from "next/dynamic";

const ReactPdfDocument = dynamic(
  () => import("react-pdf").then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return { default: mod.Document };
  }),
  { ssr: false }
);
const ReactPdfPage = dynamic(
  () => import("react-pdf").then((mod) => ({ default: mod.Page })),
  { ssr: false }
);

type Widget = {
  id: string;
  widget_type: number;
  participant_id: string;
  file_id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

type Props = {
  pdfUrl: string;
  widgets: Widget[];
  widgetValues: Record<string, string>;
  senderParticipantId: string;
  onWidgetClick?: (widgetId: string) => void;
};

export function PdfPreviewWithOverlay({
  pdfUrl,
  widgets,
  widgetValues,
  senderParticipantId,
  onWidgetClick,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [pageDimensions, setPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  // canvas実測値で配置するオーバーレイコンテナのスタイル
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties | null>(null);

  // ResizeObserver でコンテナ幅を監視
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
      setCurrentPage(1);
    },
    []
  );

  const onPageLoadSuccess = useCallback(
    (page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
      // CloudSignのwidget座標はPDFポイント(scale=1)基準なので、
      // スケール後の width ではなく originalWidth を使う
      setPageDimensions({
        width: page.originalWidth,
        height: page.originalHeight,
      });
    },
    []
  );

  // canvasの実測位置・サイズに一致するオーバーレイスタイルを計算
  const measureCanvas = useCallback(() => {
    const wrapper = pageWrapperRef.current;
    if (!wrapper) return;
    const canvas = wrapper.querySelector("canvas");
    if (!canvas) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    setOverlayStyle({
      position: "absolute",
      left: Math.round(canvasRect.left - wrapperRect.left),
      top: Math.round(canvasRect.top - wrapperRect.top),
      width: Math.round(canvasRect.width),
      height: Math.round(canvasRect.height),
      pointerEvents: "none" as const,
    });
  }, []);

  const onRenderSuccess = useCallback(() => {
    measureCanvas();
  }, [measureCanvas]);

  // zoom変更・ページ切替時にも再計測
  useEffect(() => {
    const timer = setTimeout(measureCanvas, 50);
    return () => clearTimeout(timer);
  }, [zoom, currentPage, measureCanvas]);

  // PDFページ幅をコンテナにフィット
  const fitWidth = Math.max(containerWidth - 32, 300); // 16px padding each side
  const pageWidth = fitWidth * zoom;

  // 現在ページのwidgetをフィルタ
  const pageWidgets = widgets.filter((w) => w.page === currentPage - 1);

  return (
    <div ref={containerRef} className="flex flex-col h-full min-h-0">
      {/* ツールバー */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-600 min-w-[60px] text-center">
            {currentPage} / {numPages || "–"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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

      {/* PDFビューア */}
      <div className="flex-1 overflow-auto bg-gray-100 min-h-0">
        <div className="flex justify-center p-4">
          <div ref={pageWrapperRef} className="relative inline-block shadow-lg">
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
              <ReactPdfPage
                pageNumber={currentPage}
                width={pageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onLoadSuccess={onPageLoadSuccess}
                onRenderSuccess={onRenderSuccess}
              />
            </ReactPdfDocument>

            {/* Widget overlays — canvasにぴったり一致するコンテナ内で%配置 */}
            {pageDimensions && overlayStyle && (
              <div style={overlayStyle}>
                {pageWidgets.map((w) => {
                  const isSender = w.participant_id === senderParticipantId;
                  const value = widgetValues[w.id] || "";
                  // PDF座標の比率で%配置 — スケール計算不要
                  const pctLeft = (w.x / pageDimensions.width) * 100;
                  const pctTop = (w.y / pageDimensions.height) * 100;
                  const pctWidth = (w.w / pageDimensions.width) * 100;
                  const pctHeight = (w.h / pageDimensions.height) * 100;
                  // フォントサイズ用にピクセル高さを概算
                  const pxHeight = (w.h / pageDimensions.height) * (Number(overlayStyle.height) || 800);

                  return (
                    <div
                      key={w.id}
                      className={`absolute cursor-pointer transition-colors ${
                        isSender
                          ? "bg-blue-500/15 border border-blue-400/60 hover:bg-blue-500/25"
                          : "bg-gray-400/10 border border-gray-400/40 border-dashed hover:bg-gray-400/20"
                      }`}
                      style={{
                        boxSizing: "border-box",
                        pointerEvents: "auto",
                        left: `${pctLeft}%`,
                        top: `${pctTop}%`,
                        width: `${pctWidth}%`,
                        height: `${pctHeight}%`,
                      }}
                      onClick={() => onWidgetClick?.(w.id)}
                      title={w.label || ""}
                    >
                      <div
                        className="flex items-center justify-center h-full overflow-hidden px-0.5"
                        style={{ fontSize: Math.max(8, Math.min(pxHeight * 0.6, 14)) }}
                      >
                        {w.widget_type === 0 ? (
                          <span className="text-purple-500 font-medium truncate">
                            署名
                          </span>
                        ) : w.widget_type === 2 ? (
                          value === "1" ? (
                            <span className="text-green-600 font-bold">✓</span>
                          ) : (
                            <span className="text-gray-400 truncate">
                              {w.label || "☐"}
                            </span>
                          )
                        ) : value ? (
                          <span className="text-blue-700 font-medium truncate">
                            {value}
                          </span>
                        ) : (
                          <span className="text-gray-400/70 truncate">
                            {w.label || "入力"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
