#!/usr/bin/env node
/**
 * ProLine友達データ同期スクリプト（SLPプロジェクト用）
 * VPSホスト上で実行（crontab or トリガーサーバー経由）
 *
 * 依存: puppeteer, xlsx（~/proline-deps/に別途インストール）
 * 環境変数: PROLINE_EMAIL, PROLINE_PASSWORD, CRON_SECRET, APP_URL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const depsPath = path.resolve(__dirname, "..", "..", "proline-deps", "node_modules");
const puppeteer = require(path.join(depsPath, "puppeteer"));
const XLSX = require(path.join(depsPath, "xlsx"));

// 環境変数読み込み（.env.syncファイルがあれば読む）
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

const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = process.env.APP_URL || "http://localhost:4001";

// レガシー: 環境変数からのフォールバック（CRM設定が優先）
const PROLINE_EMAIL = process.env.PROLINE_EMAIL;
const PROLINE_PASSWORD = process.env.PROLINE_PASSWORD;

if (!CRON_SECRET) {
  console.error("必要な環境変数が設定されていません: CRON_SECRET");
  process.exit(1);
}

/**
 * CRM設定画面に登録されたプロラインアカウント情報を取得
 */
async function fetchProlineAccount() {
  console.log("[sync-proline] CRMからプロラインアカウント情報を取得中...");
  try {
    const res = await fetch(`${APP_URL}/api/cron/slp-proline-accounts`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.accounts && data.accounts.length > 0) {
        const account = data.accounts[0];
        if (account.email && account.password) {
          console.log(`[sync-proline] CRM設定を使用: ${account.label}`);
          return account;
        }
      }
    }
  } catch (err) {
    console.log(`[sync-proline] CRM設定取得失敗（${err.message}）、環境変数にフォールバック`);
  }

  // フォールバック: 環境変数
  if (PROLINE_EMAIL && PROLINE_PASSWORD) {
    console.log("[sync-proline] 環境変数を使用（レガシーモード）");
    return { email: PROLINE_EMAIL, password: PROLINE_PASSWORD, loginUrl: null, label: "SLP" };
  }

  console.error("プロラインアカウント情報が見つかりません。CRM設定画面または環境変数で設定してください。");
  process.exit(1);
}

const DOWNLOAD_DIR = path.join(__dirname, ".proline-downloads");

// カラムマッピング（Excelの列インデックス → フィールド名）
const COLUMN_MAP = {
  0: "number",        // A: 番号（使用しない）
  1: "snsname",       // B: アカウント名
  2: "password",      // C: パスワード
  3: "emailLine",     // D: LINE送信専用メルアド
  4: "emailRenkei",   // E: 連携用メールアドレス
  5: "emailLine2",    // F: LINE送信専用メルアド２
  6: "email",         // G: メールアドレス
  7: "uid",           // H: ユーザーID
  8: "friendAddedDate", // I: 友だち追加日
  9: "activeStatus",  // J: 稼働状態
  10: "lastActivityDate", // K: 最終活動日
  11: "sei",          // L: 姓
  12: "mei",          // M: 名
  13: "nickname",     // N: ニックネーム
  14: "phone",        // O: 電話番号
  15: "postcode",     // P: 郵便番号
  16: "address1",     // Q: 住所１
  17: "address2",     // R: 住所２
  18: "address3",     // S: 住所３
  19: "nenrei",       // T: 年齢
  20: "nendai",       // U: 年代
  21: "seibetu",      // V: 性別
  22: "free1",        // W: フリー項目１
  23: "free2",        // X: フリー項目２
  24: "free3",        // Y: フリー項目３
  25: "free4",        // Z: フリー項目４
  26: "free5",        // AA: フリー項目５
  27: "free6",        // AB: フリー項目６
  28: "scenarioPos1", // AC: シナリオ位置1
  29: "scenarioPos2", // AD: 現在の場所2
  30: "scenarioPos3", // AE: 現在の場所3
  31: "scenarioPos4", // AF: 現在の場所4
  32: "scenarioPos5", // AG: 現在の場所5
};

function cellValue(row, idx) {
  const val = row[idx];
  if (val === null || val === undefined) return null;
  return String(val).trim() || null;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === "number") {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString();
  }
  const str = String(val).trim();
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

async function downloadExcel(account) {
  if (fs.existsSync(DOWNLOAD_DIR)) {
    fs.rmSync(DOWNLOAD_DIR, { recursive: true });
  }
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  console.log("[sync-proline] Puppeteerブラウザ起動...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: DOWNLOAD_DIR,
    });

    console.log("[sync-proline] プロラインにログイン中...");

    // ログイン方式1: ログインURL（パスワード入力画面に直接遷移）
    async function loginWithUrl(p) {
      console.log(`[sync-proline] ログインURL使用: ${account.loginUrl}`);
      await p.goto(account.loginUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await p.waitForSelector('input#password', { timeout: 15000 });
    }

    // ログイン方式2: 2段階ログイン（メール→次へ→パスワード）
    async function loginWithEmail(p) {
      console.log("[sync-proline] メールアドレスで2段階ログイン");
      await p.goto('https://autosns.jp/login', { waitUntil: "networkidle2", timeout: 30000 });
      await p.type('input#email', account.email);
      await p.click('button[name="send"]');
      await p.waitForSelector('input#password', { timeout: 15000 });
    }

    // 優先方式を試し、失敗したらもう一方で再試行
    const primary = account.loginUrl ? loginWithUrl : loginWithEmail;
    const fallback = account.loginUrl ? loginWithEmail : loginWithUrl;

    try {
      await primary(page);
    } catch (err) {
      if (!account.loginUrl || !account.email) throw err;
      console.log(`[sync-proline] 第1方式失敗（${err.message}）、第2方式で再試行...`);
      await page.goto('about:blank');
      await fallback(page);
    }

    // パスワード入力 → ログイン
    await page.type('input#password', account.password);
    await Promise.all([
      page.click('button#btnSubmit'),
      page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => {}),
    ]);
    await new Promise((r) => setTimeout(r, 3000));

    console.log("[sync-proline] ユーザー管理ページに移動...");
    await page.goto(
      `https://autosns.jp/select-user`,
      { waitUntil: "load", timeout: 60000 }
    );

    console.log("[sync-proline] Excelダウンロード中...");
    await page.click("#link-download-xls");

    let xlsFile = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const files = fs.readdirSync(DOWNLOAD_DIR);
      const xls = files.find(
        (f) => (f.endsWith(".xlsx") || f.endsWith(".xls")) && !f.endsWith(".crdownload")
      );
      if (xls) {
        xlsFile = path.join(DOWNLOAD_DIR, xls);
        break;
      }
    }

    if (!xlsFile) {
      throw new Error("Excelファイルのダウンロードがタイムアウトしました");
    }

    console.log(`[sync-proline] ダウンロード完了: ${xlsFile}`);
    return xlsFile;
  } finally {
    await browser.close();
  }
}

function parseExcel(filePath) {
  console.log("[sync-proline] Excelパース中...");
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const friends = [];
  for (let i = 5; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !row[7]) continue;

    const friend = {};
    for (const [colIdx, fieldName] of Object.entries(COLUMN_MAP)) {
      if (fieldName === "number") continue;
      const idx = parseInt(colIdx);
      if (fieldName === "friendAddedDate") {
        friend[fieldName] = parseExcelDate(row[idx]);
      } else {
        friend[fieldName] = cellValue(row, idx);
      }
    }
    friends.push(friend);
  }

  friends.sort((a, b) => {
    const da = a.friendAddedDate ? new Date(a.friendAddedDate).getTime() : 0;
    const db = b.friendAddedDate ? new Date(b.friendAddedDate).getTime() : 0;
    return da - db;
  });

  console.log(`[sync-proline] ${friends.length}件のデータをパース`);
  return friends;
}

async function syncToApp(friends) {
  console.log(`[sync-proline] ${APP_URL}/api/cron/sync-line-friends にPOST中...`);

  const res = await fetch(`${APP_URL}/api/cron/sync-line-friends`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ friends }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return await res.json();
}

async function main() {
  const startTime = Date.now();
  console.log(`[sync-proline] 同期開始: ${new Date().toISOString()}`);

  try {
    const account = await fetchProlineAccount();
    const xlsFile = await downloadExcel(account);
    const friends = parseExcel(xlsFile);
    const result = await syncToApp(friends);

    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[sync-proline] 同期完了: created=${result.created}, updated=${result.updated}, total=${result.total} (${elapsed}秒)`
    );

    return result;
  } catch (err) {
    console.error("[sync-proline] エラー:", err.message);
    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }
    process.exit(1);
  }
}

main();
