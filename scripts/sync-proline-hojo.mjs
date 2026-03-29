#!/usr/bin/env node
/**
 * 補助金プロジェクト ProLine友達データ同期スクリプト
 * VPSホスト上で実行（crontab経由）
 *
 * 4アカウント分を順番に同期:
 *   1. 申請サポートセンター (shinsei-support)
 *   2. 一般社団法人助成金申請サポート (josei-support)
 *   3. ALKES (alkes)
 *   4. セキュリティクラウドサポート (security-cloud)
 *
 * 依存: puppeteer, xlsx（VPSホストに別途インストール）
 * 環境変数: .env.sync.hojo から読み込み
 */

import puppeteer from "puppeteer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 環境変数読み込み
const envPath = path.join(__dirname, ".env.sync.hojo");
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

// 4アカウントの設定
const ACCOUNTS = [
  {
    key: "shinsei-support",
    name: "申請サポートセンター",
    email: process.env.HOJO_SHINSEI_PROLINE_EMAIL,
    password: process.env.HOJO_SHINSEI_PROLINE_PASSWORD,
    loginUid: process.env.HOJO_SHINSEI_PROLINE_LOGIN_UID,
    syncEndpoint: "/api/cron/sync-hojo-line-friends/shinsei-support",
  },
  {
    key: "josei-support",
    name: "一般社団法人助成金申請サポート",
    email: process.env.HOJO_JOSEI_PROLINE_EMAIL,
    password: process.env.HOJO_JOSEI_PROLINE_PASSWORD,
    loginUid: process.env.HOJO_JOSEI_PROLINE_LOGIN_UID,
    syncEndpoint: "/api/cron/sync-hojo-line-friends/josei-support",
  },
  {
    key: "alkes",
    name: "ALKES",
    email: process.env.HOJO_ALKES_PROLINE_EMAIL,
    password: process.env.HOJO_ALKES_PROLINE_PASSWORD,
    loginUid: process.env.HOJO_ALKES_PROLINE_LOGIN_UID,
    syncEndpoint: "/api/cron/sync-hojo-line-friends/alkes",
  },
  {
    key: "security-cloud",
    name: "セキュリティクラウドサポート",
    email: process.env.HOJO_SECURITY_PROLINE_EMAIL,
    password: process.env.HOJO_SECURITY_PROLINE_PASSWORD,
    loginUid: process.env.HOJO_SECURITY_PROLINE_LOGIN_UID,
    syncEndpoint: "/api/cron/sync-hojo-line-friends/security-cloud",
  },
];

if (!CRON_SECRET) {
  console.error("CRON_SECRET が設定されていません");
  process.exit(1);
}

const DOWNLOAD_DIR = path.join(__dirname, ".proline-downloads-hojo");

const COLUMN_MAP = {
  0: "number",
  1: "snsname",
  2: "password",
  3: "emailLine",
  4: "emailRenkei",
  5: "emailLine2",
  6: "email",
  7: "uid",
  8: "friendAddedDate",
  9: "activeStatus",
  10: "lastActivityDate",
  11: "sei",
  12: "mei",
  13: "nickname",
  14: "phone",
  15: "postcode",
  16: "address1",
  17: "address2",
  18: "address3",
  19: "nenrei",
  20: "nendai",
  21: "seibetu",
  22: "free1",
  23: "free2",
  24: "free3",
  25: "free4",
  26: "free5",
  27: "free6",
  28: "scenarioPos1",
  29: "scenarioPos2",
  30: "scenarioPos3",
  31: "scenarioPos4",
  32: "scenarioPos5",
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

  console.log(`[sync-hojo:${account.key}] Puppeteerブラウザ起動...`);
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

    console.log(`[sync-hojo:${account.key}] ProLineにログイン中...`);
    await page.goto(
      `https://line.and-motions.com/login?uid=${account.loginUid}`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );

    await page.type('input[name="email"], input[type="email"]', account.email);
    await page.type('input[name="password"], input[type="password"]', account.password);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

    console.log(`[sync-hojo:${account.key}] ユーザー管理ページに移動...`);
    await page.goto(
      `https://line.and-motions.com/manager/user?uid=${account.loginUid}`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );

    console.log(`[sync-hojo:${account.key}] Excelダウンロード中...`);
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

    console.log(`[sync-hojo:${account.key}] ダウンロード完了: ${xlsFile}`);
    return xlsFile;
  } finally {
    await browser.close();
  }
}

function parseExcel(filePath, accountKey) {
  console.log(`[sync-hojo:${accountKey}] Excelパース中...`);
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

  console.log(`[sync-hojo:${accountKey}] ${friends.length}件のデータをパース`);
  return friends;
}

async function syncToApp(friends, account) {
  const url = `${APP_URL}${account.syncEndpoint}`;
  console.log(`[sync-hojo:${account.key}] ${url} にPOST中...`);

  const res = await fetch(url, {
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

async function syncAccount(account) {
  if (!account.email || !account.password || !account.loginUid) {
    console.warn(`[sync-hojo:${account.key}] 環境変数未設定のためスキップ`);
    return null;
  }

  const startTime = Date.now();
  console.log(`\n[sync-hojo:${account.key}] === ${account.name} 同期開始 ===`);

  try {
    const xlsFile = await downloadExcel(account);
    const friends = parseExcel(xlsFile, account.key);
    const result = await syncToApp(friends, account);

    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[sync-hojo:${account.key}] 同期完了: created=${result.created}, updated=${result.updated}, total=${result.total} (${elapsed}秒)`
    );

    return result;
  } catch (err) {
    console.error(`[sync-hojo:${account.key}] エラー:`, err.message);
    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }
    return null;
  }
}

async function main() {
  const startTime = Date.now();
  console.log(`[sync-hojo] 全アカウント同期開始: ${new Date().toISOString()}`);

  const results = {};
  for (const account of ACCOUNTS) {
    results[account.key] = await syncAccount(account);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[sync-hojo] 全アカウント同期完了 (${elapsed}秒)`);

  for (const [key, result] of Object.entries(results)) {
    if (result) {
      console.log(`  ${key}: created=${result.created}, updated=${result.updated}, total=${result.total}`);
    } else {
      console.log(`  ${key}: スキップまたはエラー`);
    }
  }
}

main();
