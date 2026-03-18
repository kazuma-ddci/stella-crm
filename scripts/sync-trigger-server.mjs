#!/usr/bin/env node
/**
 * ProLine同期トリガーサーバー
 * VPSホスト上でsystemdサービスとして常駐。
 * Docker内のNext.jsアプリからHTTPリクエストで同期を起動する。
 *
 * ポート: 3100（localhost:3100、外部公開しない）
 * GET /trigger?secret=CRON_SECRET → sync-proline.mjs を実行
 */

import http from "http";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 環境変数読み込み
const envPath = path.join(__dirname, ".env.sync");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const PORT = parseInt(process.env.TRIGGER_PORT || "3100");
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("CRON_SECRET 環境変数が設定されていません");
  process.exit(1);
}

let isRunning = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ヘルスチェック
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", isRunning }));
    return;
  }

  // トリガーエンドポイント
  if (url.pathname === "/trigger") {
    const secret = url.searchParams.get("secret");
    if (secret !== CRON_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (isRunning) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "同期処理が既に実行中です" }));
      return;
    }

    isRunning = true;
    console.log(`[trigger] 同期開始: ${new Date().toISOString()}`);

    const scriptPath = path.join(__dirname, "sync-proline.mjs");
    execFile("node", [scriptPath], { timeout: 180000 }, (error, stdout, stderr) => {
      isRunning = false;

      if (error) {
        console.error(`[trigger] 同期エラー:`, error.message);
        if (stderr) console.error(stderr);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "同期に失敗しました", details: error.message }));
        return;
      }

      if (stdout) console.log(stdout);
      console.log(`[trigger] 同期完了: ${new Date().toISOString()}`);

      // stdoutから結果をパース
      const match = stdout.match(/created=(\d+), updated=(\d+), total=(\d+)/);
      const result = match
        ? { created: parseInt(match[1]), updated: parseInt(match[2]), total: parseInt(match[3]) }
        : {};

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, ...result }));
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[trigger] ProLine同期トリガーサーバー起動: http://127.0.0.1:${PORT}`);
});
