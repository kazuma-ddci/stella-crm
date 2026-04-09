#!/usr/bin/env node
/**
 * 補助金プロジェクト ProLine友達データ同期スクリプト
 * VPSホスト上で実行（crontab経由、毎時）
 *
 * CRM設定画面に登録された4つの公式LINEアカウントのプロライン情報を取得し、
 * 各アカウントのExcelをダウンロードしてCRMに同期する。
 *
 * 依存: puppeteer, xlsx（VPSホストに別途インストール）
 * 環境変数: CRON_SECRET, APP_URL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// スクリプトは ~/stella-crm/scripts/ にあるので、../../proline-deps で ~/proline-deps に到達
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

if (!CRON_SECRET) {
  console.error("必要な環境変数が設定されていません: CRON_SECRET");
  process.exit(1);
}

const DOWNLOAD_DIR = path.join(__dirname, ".hojo-proline-downloads");

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

/**
 * プロライン Excel エクスポートの「姓」列に「姓 名」が結合された値が
 * 入ってくるため、姓と名を分離する正規化処理。
 *
 * プロラインの実際の出力パターン:
 *   1. 姓="田中", 名="太郎"  → sei="田中 太郎", mei="太郎"
 *   2. 姓="田中", 名=""      → sei="田中",      mei=""
 *   3. 姓="",     名="太郎"  → sei="",          mei="太郎"
 *
 * sei が " " + mei または "　" + mei で終わっている場合は末尾を除去する。
 */
function normalizeSeiMei(sei, mei) {
  const seiVal = sei && sei.trim() !== "" ? sei.trim() : null;
  const meiVal = mei && mei.trim() !== "" ? mei.trim() : null;

  if (!seiVal) return { sei: null, mei: meiVal };
  if (!meiVal) return { sei: seiVal, mei: null };

  for (const sep of [" ", "　"]) {
    const suffix = sep + meiVal;
    if (seiVal.endsWith(suffix)) {
      const cleanSei = seiVal.slice(0, seiVal.length - suffix.length).trim();
      return { sei: cleanSei !== "" ? cleanSei : null, mei: meiVal };
    }
  }

  if (seiVal === meiVal) return { sei: null, mei: meiVal };

  return { sei: seiVal, mei: meiVal };
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

/**
 * CRM設定画面に登録されたプロラインアカウント情報を取得
 */
async function fetchProlineAccounts() {
  console.log("[sync-hojo] プロラインアカウント情報を取得中...");
  const res = await fetch(`${APP_URL}/api/cron/hojo-proline-accounts`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`プロラインアカウント取得エラー ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.accounts || data.accounts.length === 0) {
    throw new Error("プロラインアカウントが登録されていません。CRMの設定画面から登録してください。");
  }

  console.log(`[sync-hojo] ${data.accounts.length}件のアカウントを取得`);
  return data.accounts;
}

/**
 * ProLineにログインしてExcelをダウンロード
 */
async function downloadExcel(account) {
  const downloadDir = path.join(DOWNLOAD_DIR, account.lineType);
  if (fs.existsSync(downloadDir)) {
    fs.rmSync(downloadDir, { recursive: true });
  }
  fs.mkdirSync(downloadDir, { recursive: true });

  console.log(`[sync-hojo] [${account.label}] Puppeteerブラウザ起動...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });

    console.log(`[sync-hojo] [${account.label}] プロラインにログイン中...`);

    // ログイン方式1: ログインURL（パスワード入力画面に直接遷移）
    async function loginWithUrl(p) {
      console.log(`[sync-hojo] [${account.label}] ログインURL使用: ${account.loginUrl}`);
      await p.goto(account.loginUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await p.waitForSelector('input#password', { timeout: 15000 });
    }

    // ログイン方式2: 2段階ログイン（メール→次へ→パスワード）
    async function loginWithEmail(p) {
      console.log(`[sync-hojo] [${account.label}] メールアドレスで2段階ログイン`);
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
      // loginUrlがない場合はfallbackも同じなのでスキップ
      if (!account.loginUrl || !account.email) throw err;
      console.log(`[sync-hojo] [${account.label}] 第1方式失敗（${err.message}）、第2方式で再試行...`);
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

    console.log(`[sync-hojo] [${account.label}] ユーザー管理ページに移動...`);
    await page.goto(
      `https://autosns.jp/select-user`,
      { waitUntil: "load", timeout: 60000 }
    );

    console.log(`[sync-hojo] [${account.label}] Excelダウンロード中...`);
    await page.click("#link-download-xls");

    let xlsFile = null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const files = fs.readdirSync(downloadDir);
      const xls = files.find(
        (f) => (f.endsWith(".xlsx") || f.endsWith(".xls")) && !f.endsWith(".crdownload")
      );
      if (xls) {
        xlsFile = path.join(downloadDir, xls);
        break;
      }
    }

    if (!xlsFile) {
      throw new Error(`[${account.label}] Excelファイルのダウンロードがタイムアウトしました`);
    }

    console.log(`[sync-hojo] [${account.label}] ダウンロード完了: ${xlsFile}`);
    return xlsFile;
  } finally {
    await browser.close();
  }
}

/**
 * Excelをパースして友達追加日昇順でソート
 */
function parseExcel(filePath, label) {
  console.log(`[sync-hojo] [${label}] Excelパース中...`);
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
    // 姓名の正規化（プロライン側で「姓」に「姓 名」が結合された値が
    // 入ってくるケースに対応）
    const normalized = normalizeSeiMei(friend.sei, friend.mei);
    friend.sei = normalized.sei;
    friend.mei = normalized.mei;
    friends.push(friend);
  }

  // 友だち追加日昇順ソート
  friends.sort((a, b) => {
    const da = a.friendAddedDate ? new Date(a.friendAddedDate).getTime() : 0;
    const db = b.friendAddedDate ? new Date(b.friendAddedDate).getTime() : 0;
    return da - db;
  });

  console.log(`[sync-hojo] [${label}] ${friends.length}件のデータをパース`);
  return friends;
}

/**
 * CRMのAPIにデータを送信
 */
async function syncToApp(friends, lineType, label) {
  const endpoint = `${APP_URL}/api/cron/sync-hojo-line-friends/${lineType}`;
  console.log(`[sync-hojo] [${label}] ${endpoint} にPOST中...`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({ friends }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${label}] API error ${res.status}: ${text}`);
  }

  return await res.json();
}

/**
 * 1アカウント分の同期処理
 */
async function syncOneAccount(account) {
  const startTime = Date.now();
  console.log(`\n[sync-hojo] === ${account.label} (${account.lineType}) 同期開始 ===`);

  try {
    const xlsFile = await downloadExcel(account);
    const friends = parseExcel(xlsFile, account.label);
    const result = await syncToApp(friends, account.lineType, account.label);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[sync-hojo] [${account.label}] 同期完了: created=${result.created}, updated=${result.updated}, total=${result.total} (${elapsed}秒)`
    );

    return { lineType: account.lineType, label: account.label, success: true, ...result, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[sync-hojo] [${account.label}] エラー: ${err.message}`);
    return { lineType: account.lineType, label: account.label, success: false, error: err.message, elapsed };
  }
}

// --account オプション: 指定されたアカウントのみ同期（トリガーサーバーから呼ばれる場合）
const accountArg = (() => {
  const idx = process.argv.indexOf("--account");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
})();

async function main() {
  const startTime = Date.now();
  const modeLabel = accountArg ? `単体同期: ${accountArg}` : "全アカウント同期";
  console.log(`[sync-hojo] 補助金プロライン同期開始 (${modeLabel}): ${new Date().toISOString()}`);

  try {
    // 1. CRMからプロラインアカウント情報を取得
    let accounts = await fetchProlineAccounts();

    // --account指定時は対象アカウントのみに絞る
    if (accountArg) {
      accounts = accounts.filter((a) => a.lineType === accountArg);
      if (accounts.length === 0) {
        throw new Error(`アカウント "${accountArg}" が見つかりません`);
      }
    }

    // 2. 各アカウントを順番に同期（Puppeteerの並列実行を避ける）
    const results = [];
    for (const account of accounts) {
      const result = await syncOneAccount(account);
      results.push(result);
    }

    // 3. クリーンアップ
    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }

    // 4. サマリー
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`\n[sync-hojo] ========== 同期完了サマリー ==========`);
    for (const r of results) {
      if (r.success) {
        console.log(`  ✅ ${r.label}: created=${r.created}, updated=${r.updated}, total=${r.total} (${r.elapsed}秒)`);
      } else {
        console.log(`  ❌ ${r.label}: ${r.error} (${r.elapsed}秒)`);
      }
    }
    console.log(`[sync-hojo] 合計: 成功=${successCount}, 失敗=${failCount}, 所要時間=${totalElapsed}秒`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("[sync-hojo] 致命的エラー:", err.message);
    if (fs.existsSync(DOWNLOAD_DIR)) {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true });
    }
    process.exit(1);
  }
}

main();
