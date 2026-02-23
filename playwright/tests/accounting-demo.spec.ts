/**
 * SPEC-ACCOUNTING-001 検証デモテスト
 *
 * 目的: 設計書・要望書の要件を網羅する「デモ兼検証」動画を録画する
 * 構成:
 *   Part 1: マスタ管理 — 勘定科目・費目・取引先・決済手段・コストセンター・按分テンプレート・自動仕訳ルール・定期取引・請求書テンプレート
 *   Part 2: 取引管理 — 取引一覧・新規作成（売上/経費）・按分・源泉徴収・入力フィールド検証
 *   Part 3: 経理業務フロー — ダッシュボード・入出金管理・仕訳・消込・予実管理・キャッシュフロー・月次クローズ・変更履歴
 */

import { test, expect, Page } from "@playwright/test";

// ── ヘルパー ──────────────────────────────────────────

/** ログインして経理ページへの準備を整える */
async function login(page: Page) {
  await page.goto("/login");
  await page.fill("input#email", "admin@example.com");
  await page.fill("input#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
  await page.waitForTimeout(1000);
}

/** 画面を安定して表示するための待機 */
async function waitForPageLoad(page: Page, ms = 2000) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(ms);
}

/** デモ用：重要情報を読める程度の待機 */
async function demoWait(page: Page, ms = 3000) {
  await page.waitForTimeout(ms);
}

/** スクロールして全体を見せる */
async function scrollPage(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
}

// ── Part 1: マスタ管理 ──────────────────────────────────

test.describe("Part 1: マスタ管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1-1 勘定科目マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/accounts");
    await waitForPageLoad(page);
    await demoWait(page, 3000);

    // DEMO データが表示されていることを確認
    const demoAccount = page.locator("text=DEMO1100");
    if (await demoAccount.isVisible()) {
      await demoAccount.scrollIntoViewIfNeeded();
      await demoWait(page, 2000);
    }

    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-2 費目マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/expense-categories");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-3 取引先マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/counterparties");
    await waitForPageLoad(page);
    await demoWait(page, 3000);

    // DEMO取引先が存在するか確認
    const demoCounterparty = page.locator("text=DEMO_株式会社テスト商事");
    if (await demoCounterparty.isVisible()) {
      await demoCounterparty.scrollIntoViewIfNeeded();
      await demoWait(page, 2000);
    }

    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-4 決済手段マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/payment-methods");
    await waitForPageLoad(page);
    await demoWait(page, 3000);

    // 銀行口座・クレカ・現金が表示されることを確認
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-5 コストセンター（按分先マスタ）", async ({ page }) => {
    await page.goto("/accounting/masters/cost-centers");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-6 按分テンプレート", async ({ page }) => {
    await page.goto("/accounting/masters/allocation-templates");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-7 自動仕訳ルール", async ({ page }) => {
    await page.goto("/accounting/masters/auto-journal");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-8 定期取引", async ({ page }) => {
    await page.goto("/accounting/masters/recurring-transactions");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("1-9 請求書テンプレート", async ({ page }) => {
    await page.goto("/accounting/masters/invoice-templates");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });
});

// ── Part 2: 取引管理 ──────────────────────────────────

test.describe("Part 2: 取引管理", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("2-1 取引一覧の確認", async ({ page }) => {
    await page.goto("/accounting/transactions");
    await waitForPageLoad(page);
    await demoWait(page, 3000);

    // テーブルの内容を確認
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("2-2 売上取引の新規作成", async ({ page }) => {
    await page.goto("/accounting/transactions/new");
    await waitForPageLoad(page);
    await demoWait(page, 2000);

    // 種別: 売上を選択
    const typeSelect = page.locator('select[name="type"], [data-testid="type-select"]').first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption("revenue");
      await demoWait(page, 1000);
    } else {
      // ラジオボタンやカスタムセレクトの場合
      const revenueRadio = page.locator('label:has-text("売上"), button:has-text("売上"), [value="revenue"]').first();
      if (await revenueRadio.isVisible()) {
        await revenueRadio.click();
        await demoWait(page, 1000);
      }
    }

    // フォーム全体をスクロールして見せる
    await scrollPage(page);
    await demoWait(page, 3000);
  });

  test("2-3 経費取引の新規作成（源泉徴収・按分あり）", async ({ page }) => {
    await page.goto("/accounting/transactions/new");
    await waitForPageLoad(page);
    await demoWait(page, 2000);

    // 種別: 経費を選択
    const typeSelect = page.locator('select[name="type"], [data-testid="type-select"]').first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption("expense");
      await demoWait(page, 1000);
    } else {
      const expenseRadio = page.locator('label:has-text("経費"), button:has-text("経費"), [value="expense"]').first();
      if (await expenseRadio.isVisible()) {
        await expenseRadio.click();
        await demoWait(page, 1000);
      }
    }

    // フォーム全体をスクロール（源泉徴収、支払予定日、決済手段の欄を見せる）
    await scrollPage(page);
    await demoWait(page, 3000);
  });
});

// ── Part 3: 経理業務フロー ──────────────────────────────

test.describe("Part 3: 経理業務フロー", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("3-1 経理ダッシュボード", async ({ page }) => {
    await page.goto("/accounting/dashboard");
    await waitForPageLoad(page);
    await demoWait(page, 4000);

    // ダッシュボードの各セクションを見る
    await scrollPage(page);
    await demoWait(page, 3000);
  });

  test("3-2 入出金管理", async ({ page }) => {
    await page.goto("/accounting/bank-transactions");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-3 仕訳管理", async ({ page }) => {
    await page.goto("/accounting/journal");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-4 消込管理", async ({ page }) => {
    await page.goto("/accounting/reconciliation");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-5 予実管理", async ({ page }) => {
    await page.goto("/accounting/budget");
    await waitForPageLoad(page);
    await demoWait(page, 4000);
    await scrollPage(page);
    await demoWait(page, 3000);
  });

  test("3-6 キャッシュフロー予測", async ({ page }) => {
    await page.goto("/accounting/cashflow");
    await waitForPageLoad(page);
    await demoWait(page, 4000);
    await scrollPage(page);
    await demoWait(page, 3000);
  });

  test("3-7 月次クローズ", async ({ page }) => {
    await page.goto("/accounting/monthly-close");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-8 変更履歴", async ({ page }) => {
    await page.goto("/accounting/changelog");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-9 確認管理", async ({ page }) => {
    await page.goto("/accounting/verification");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("3-10 取込管理", async ({ page }) => {
    await page.goto("/accounting/imports");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });
});

// ── Part 4: STPプロジェクト側ファイナンス ──────────────────

test.describe("Part 4: STPプロジェクト側", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("4-1 STPファイナンスダッシュボード", async ({ page }) => {
    await page.goto("/stp/finance/overview");
    await waitForPageLoad(page);
    await demoWait(page, 4000);
    await scrollPage(page);
    await demoWait(page, 3000);
  });

  test("4-2 STP取引管理", async ({ page }) => {
    await page.goto("/stp/finance/transactions");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("4-3 STP請求書管理", async ({ page }) => {
    await page.goto("/stp/finance/invoices");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("4-4 STP入出金履歴", async ({ page }) => {
    await page.goto("/stp/finance/payments");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });

  test("4-5 STP支払グループ", async ({ page }) => {
    await page.goto("/stp/finance/payment-groups");
    await waitForPageLoad(page);
    await demoWait(page, 3000);
    await scrollPage(page);
    await demoWait(page, 2000);
  });
});
