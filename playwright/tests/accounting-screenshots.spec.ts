/**
 * 各画面のスクリーンショットを撮影して内容を確認するテスト
 */
import { test, expect, Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("input#email", "admin@example.com");
  await page.fill("input#password", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

const screenshotDir = "./playwright/screenshots/accounting-verify";

test.describe("画面内容スクリーンショット確認", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // マスタ管理
  test("勘定科目マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/accounts");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/01-accounts.png`, fullPage: true });
  });

  test("費目マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/expense-categories");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/02-expense-categories.png`, fullPage: true });
  });

  test("取引先マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/counterparties");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/03-counterparties.png`, fullPage: true });
  });

  test("決済手段マスタ", async ({ page }) => {
    await page.goto("/accounting/masters/payment-methods");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/04-payment-methods.png`, fullPage: true });
  });

  test("コストセンター", async ({ page }) => {
    await page.goto("/accounting/masters/cost-centers");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/05-cost-centers.png`, fullPage: true });
  });

  test("按分テンプレート", async ({ page }) => {
    await page.goto("/accounting/masters/allocation-templates");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/06-allocation-templates.png`, fullPage: true });
  });

  test("自動仕訳ルール", async ({ page }) => {
    await page.goto("/accounting/masters/auto-journal");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/07-auto-journal.png`, fullPage: true });
  });

  test("定期取引", async ({ page }) => {
    await page.goto("/accounting/masters/recurring-transactions");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/08-recurring-transactions.png`, fullPage: true });
  });

  test("請求書テンプレート", async ({ page }) => {
    await page.goto("/accounting/masters/invoice-templates");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/09-invoice-templates.png`, fullPage: true });
  });

  // 取引管理
  test("取引一覧", async ({ page }) => {
    await page.goto("/accounting/transactions");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/10-transactions-list.png`, fullPage: true });
  });

  test("取引新規作成フォーム", async ({ page }) => {
    await page.goto("/accounting/transactions/new");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/11-transaction-new.png`, fullPage: true });
  });

  // 経理業務
  test("ダッシュボード", async ({ page }) => {
    await page.goto("/accounting/dashboard");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/12-dashboard.png`, fullPage: true });
  });

  test("入出金管理", async ({ page }) => {
    await page.goto("/accounting/bank-transactions");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/13-bank-transactions.png`, fullPage: true });
  });

  test("仕訳管理", async ({ page }) => {
    await page.goto("/accounting/journal");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/14-journal.png`, fullPage: true });
  });

  test("消込管理", async ({ page }) => {
    await page.goto("/accounting/reconciliation");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/15-reconciliation.png`, fullPage: true });
  });

  test("予実管理", async ({ page }) => {
    await page.goto("/accounting/budget");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/16-budget.png`, fullPage: true });
  });

  test("キャッシュフロー", async ({ page }) => {
    await page.goto("/accounting/cashflow");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/17-cashflow.png`, fullPage: true });
  });

  test("月次クローズ", async ({ page }) => {
    await page.goto("/accounting/monthly-close");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/18-monthly-close.png`, fullPage: true });
  });

  test("変更履歴", async ({ page }) => {
    await page.goto("/accounting/changelog");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/19-changelog.png`, fullPage: true });
  });

  // STP
  test("STPダッシュボード", async ({ page }) => {
    await page.goto("/stp/finance/overview");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/20-stp-overview.png`, fullPage: true });
  });

  test("STP請求書", async ({ page }) => {
    await page.goto("/stp/finance/invoices");
    await waitForPageLoad(page);
    await page.screenshot({ path: `${screenshotDir}/21-stp-invoices.png`, fullPage: true });
  });
});
