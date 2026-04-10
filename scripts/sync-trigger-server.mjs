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

// stg/prod で環境別の APP_URL/CRON_SECRET を切り替える用（.env.sync に追記する）
// 後方互換: 設定が無ければ既存の APP_URL/CRON_SECRET をそのまま使う
const APP_URL_STG = process.env.APP_URL_STG;
const APP_URL_PROD = process.env.APP_URL_PROD;
const CRON_SECRET_STG = process.env.CRON_SECRET_STG;
const CRON_SECRET_PROD = process.env.CRON_SECRET_PROD;

if (!CRON_SECRET && !CRON_SECRET_STG && !CRON_SECRET_PROD) {
  console.error(
    "CRON_SECRET（または CRON_SECRET_STG / CRON_SECRET_PROD）環境変数が設定されていません"
  );
  process.exit(1);
}

/**
 * env パラメータに応じて、その環境で使うべき APP_URL と CRON_SECRET を返す。
 * env が "stg" or "prod" で、かつ該当環境の値が設定されていればそれを使う。
 * それ以外（未指定/未設定）は既存の APP_URL/CRON_SECRET をフォールバックとして使う。
 */
function resolveEnvConfig(envParam) {
  if (envParam === "stg" && (APP_URL_STG || CRON_SECRET_STG)) {
    return {
      appUrl: APP_URL_STG || process.env.APP_URL,
      cronSecret: CRON_SECRET_STG || CRON_SECRET,
      resolvedEnv: "stg",
    };
  }
  if (envParam === "prod" && (APP_URL_PROD || CRON_SECRET_PROD)) {
    return {
      appUrl: APP_URL_PROD || process.env.APP_URL,
      cronSecret: CRON_SECRET_PROD || CRON_SECRET,
      resolvedEnv: "prod",
    };
  }
  // フォールバック（既存互換）
  return {
    appUrl: process.env.APP_URL,
    cronSecret: CRON_SECRET,
    resolvedEnv: "default",
  };
}

/** ラベル別の実行管理（異なるラベルは並列実行可能、同一ラベルは排他） */
const runningSet = new Set();

// 補助金プロジェクトの有効なアカウント種別
const HOJO_ACCOUNTS = ["josei-support", "shinsei-support", "alkes", "security-cloud"];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ヘルスチェック
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", running: [...runningSet] }));
    return;
  }

  // トリガーエンドポイント
  if (url.pathname === "/trigger") {
    const secret = url.searchParams.get("secret");
    // envパラメータに応じて使うAPP_URL/CRON_SECRETを切り替える（stg/prod両対応）
    const envParam = url.searchParams.get("env"); // "stg" | "prod" | null
    const { appUrl, cronSecret: expectedSecret, resolvedEnv } = resolveEnvConfig(envParam);

    if (!expectedSecret || secret !== expectedSecret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // accountパラメータで分岐
    const account = url.searchParams.get("account");
    let scriptPath;
    let scriptArgs;
    let label;

    if (account && HOJO_ACCOUNTS.includes(account)) {
      // 補助金プロジェクト: 指定アカウントのみ同期
      scriptPath = path.join(__dirname, "sync-hojo-proline.mjs");
      scriptArgs = [scriptPath, "--account", account];
      label = `${resolvedEnv}:hojo:${account}`;
    } else {
      // SLP（デフォルト）
      scriptPath = path.join(__dirname, "sync-proline.mjs");
      scriptArgs = [scriptPath];
      label = `${resolvedEnv}:slp`;
    }

    // 同一ラベルの同期が実行中なら拒否（異なるラベルは並列OK）
    if (runningSet.has(label)) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `同期処理が既に実行中です（${label}）` }));
      return;
    }

    runningSet.add(label);
    console.log(`[trigger] 同期開始 (${label}) → ${appUrl}: ${new Date().toISOString()}`);

    const execEnv = { ...process.env };
    // stg/prod 向けに APP_URL と CRON_SECRET を上書き（子プロセスの sync-proline.mjs に渡る）
    if (appUrl) execEnv.APP_URL = appUrl;
    execEnv.CRON_SECRET = expectedSecret;
    // NODE_PATH が未設定の場合、~/proline-deps/node_modules をフォールバック
    if (!execEnv.NODE_PATH) {
      const homedir = process.env.HOME || "/root";
      execEnv.NODE_PATH = `${homedir}/proline-deps/node_modules`;
    }

    execFile("node", scriptArgs, { timeout: 180000, env: execEnv }, (error, stdout, stderr) => {
      runningSet.delete(label);

      if (error) {
        console.error(`[trigger] 同期エラー (${label}):`, error.message);
        if (stderr) console.error(stderr);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "同期に失敗しました", details: error.message }));
        return;
      }

      if (stdout) console.log(stdout);
      console.log(`[trigger] 同期完了 (${label}): ${new Date().toISOString()}`);

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

// Dockerコンテナからのアクセスを受け付けるため 0.0.0.0 でリッスン
// 外部公開はファイアウォールで制御（ポート3100は外部非公開）
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[trigger] プロライン同期トリガーサーバー起動: http://0.0.0.0:${PORT}`);
});
