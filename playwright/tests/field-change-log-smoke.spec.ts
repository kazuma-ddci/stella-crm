/**
 * フィールド変更履歴 + パイプライン文言 スモークテスト
 *
 * 確認導線:
 * 1. STP企業ページ - 担当事務カラム表示、変更履歴ボタン、パイプライン文言
 * 2. 代理店ページ - 担当営業/担当事務カラム表示、変更履歴ボタン
 * 3. サイドバー - パイプライン文言
 */

import { test, expect } from "@playwright/test";

// ログインヘルパー
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill("input#email", "admin@example.com");
  await page.fill("input#password", "password123");
  await page.click('button[type="submit"]');
  // ログイン後のリダイレクトを待つ
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
}

test.describe("STP企業ページ", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/stp/companies");
    await page.waitForLoadState("networkidle");
  });

  test("担当事務カラムが表示される", async ({ page }) => {
    // テーブルヘッダーに「担当事務」が存在
    const header = page.locator("th, [role=columnheader]").filter({ hasText: "担当事務" });
    await expect(header.first()).toBeVisible();
  });

  test("担当営業カラムが表示される", async ({ page }) => {
    const header = page.locator("th, [role=columnheader]").filter({ hasText: "担当営業" });
    await expect(header.first()).toBeVisible();
  });

  test("パイプライン文言が表示される（ステージではない）", async ({ page }) => {
    // テーブルヘッダーに「パイプライン」が含まれている
    const pipelineHeader = page.locator("th, [role=columnheader]").filter({ hasText: /パイプライン/ });
    await expect(pipelineHeader.first()).toBeVisible();

    // 「ステージ」がヘッダーに含まれていない（コメントは除く）
    const stageHeaders = page.locator("th, [role=columnheader]").filter({ hasText: /^.*ステージ.*$/ });
    await expect(stageHeaders).toHaveCount(0);
  });

  test("行のアクションメニューに変更履歴ボタンが存在する", async ({ page }) => {
    // テーブルに行がある場合のみ
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // 最初の行のアクションボタンをクリック
    const firstRow = rows.first();
    const actionButtons = firstRow.locator("button");

    // 変更履歴ボタンのツールチップまたはラベルを確認
    const changeLogButton = firstRow.locator('button[title="変更履歴"], button:has-text("変更履歴")');
    // アクションドロップダウンの場合はメニューを開く
    if (await changeLogButton.count() === 0) {
      // ドロップダウンメニュー形式の場合
      const moreButton = firstRow.locator('button[aria-label="actions"], button:has(svg)').last();
      if (await moreButton.isVisible()) {
        await moreButton.click();
        const menuItem = page.locator('[role="menuitem"]').filter({ hasText: "変更履歴" });
        await expect(menuItem).toBeVisible();
      }
    } else {
      await expect(changeLogButton.first()).toBeVisible();
    }
  });
});

test.describe("代理店ページ", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/stp/agents");
    await page.waitForLoadState("networkidle");
  });

  test("担当営業カラムが表示される（担当者ではない）", async ({ page }) => {
    const salesHeader = page.locator("th, [role=columnheader]").filter({ hasText: "担当営業" });
    await expect(salesHeader.first()).toBeVisible();

    // 「担当者」単独のヘッダーがないことを確認（「請求先担当者」等は許可）
    const oldHeaders = page.locator("th, [role=columnheader]");
    const count = await oldHeaders.count();
    for (let i = 0; i < count; i++) {
      const text = await oldHeaders.nth(i).textContent();
      if (text && text.trim() === "担当者") {
        throw new Error('「担当者」のヘッダーが残っています。「担当営業」に変更されるべきです。');
      }
    }
  });

  test("担当事務カラムが表示される", async ({ page }) => {
    const header = page.locator("th, [role=columnheader]").filter({ hasText: "担当事務" });
    await expect(header.first()).toBeVisible();
  });

  test("行のアクションに変更履歴ボタンが存在する", async ({ page }) => {
    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const firstRow = rows.first();
    const changeLogButton = firstRow.locator('button[title="変更履歴"], button:has-text("変更履歴")');
    if (await changeLogButton.count() === 0) {
      const moreButton = firstRow.locator('button[aria-label="actions"], button:has(svg)').last();
      if (await moreButton.isVisible()) {
        await moreButton.click();
        const menuItem = page.locator('[role="menuitem"]').filter({ hasText: "変更履歴" });
        await expect(menuItem).toBeVisible();
      }
    } else {
      await expect(changeLogButton.first()).toBeVisible();
    }
  });
});

test.describe("サイドバー - パイプライン文言", () => {
  test("ナビゲーションに「パイプライン」が表示される", async ({ page }) => {
    await login(page);
    await page.goto("/stp/companies");
    await page.waitForLoadState("networkidle");

    // サイドバーに「パイプライン」が含まれている
    const sidebar = page.locator("nav, aside, [role=navigation]");
    const pipelineLink = sidebar.locator('a, button').filter({ hasText: /パイプライン/ });
    await expect(pipelineLink.first()).toBeVisible();
  });
});
