"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Plus, Loader2, ExternalLink } from "lucide-react";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
};

export function MultiUrlField({ value, onChange }: Props) {
  const urls = Array.isArray(value) ? value : [];
  const [newUrl, setNewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddUrl = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    onChange([...urls, trimmed]);
    setNewUrl("");
  };

  const handleRemove = (idx: number) => {
    onChange(urls.filter((_, i) => i !== idx));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/hojo/consulting/activities/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "アップロード失敗");
      onChange([...urls, json.url]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getDisplayName = (url: string) => {
    if (url.startsWith("/uploads/")) {
      const parts = url.split("/");
      const fn = parts[parts.length - 1];
      // Remove timestamp_random_ prefix for display
      return fn.replace(/^\d+_[a-z0-9]+_/, "");
    }
    return url;
  };

  return (
    <div className="space-y-2">
      {/* 既存のURL一覧 */}
      {urls.length > 0 && (
        <ul className="space-y-1.5">
          {urls.map((url, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 px-3 py-2 border rounded-md bg-gray-50"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 flex-1 text-sm text-blue-600 hover:underline truncate"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{getDisplayName(url)}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                onClick={() => handleRemove(idx)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* URL入力 + 追加 */}
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="URLを直接入力..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddUrl();
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAddUrl}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* ファイルアップロード */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              アップロード中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              ファイルをアップロード
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
