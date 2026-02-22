import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "tmp/modal-ss-stage3-extra";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('#email', "yamamoto@example.com");
  await page.fill('#password', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. 代理店ページ: 操作メニューから契約書管理
  await page.goto(`${BASE}/stp/agents`);
  await page.waitForTimeout(2500);
  // 全ての操作ボタンのテキストを確認
  const opsButtons = page.locator("button", { hasText: "操作" });
  const count = await opsButtons.count();
  console.log(`Found ${count} 操作 buttons`);
  if (count > 0) {
    await opsButtons.first().click();
    await page.waitForTimeout(500);
    // メニュー項目をすべて列挙
    const menuItems = page.locator('[role="menuitem"]');
    const menuCount = await menuItems.count();
    for (let i = 0; i < menuCount; i++) {
      const text = await menuItems.nth(i).textContent();
      console.log(`  menuitem[${i}]: "${text}"`);
    }
    // 契約書管理を探す
    for (let i = 0; i < menuCount; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text?.includes("契約書")) {
        console.log(`  -> clicking "${text}"`);
        await menuItems.nth(i).click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/agent-contracts_1280.png`, fullPage: false });
        console.log("  -> captured agent-contracts");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        break;
      }
    }
    // 紹介企業を探す
    await opsButtons.first().click();
    await page.waitForTimeout(500);
    const menuItems2 = page.locator('[role="menuitem"]');
    const menuCount2 = await menuItems2.count();
    for (let i = 0; i < menuCount2; i++) {
      const text = await menuItems2.nth(i).textContent();
      if (text?.includes("紹介企業") || text?.includes("企業一覧")) {
        console.log(`  -> clicking "${text}"`);
        await menuItems2.nth(i).click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/agent-referred_1280.png`, fullPage: false });
        console.log("  -> captured agent-referred");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        break;
      }
    }
  }

  // 2. 契約書ページ: 操作メニューから契約書管理(master-contract-modal)
  await page.goto(`${BASE}/stp/contracts`);
  await page.waitForTimeout(2500);
  const contractOps = page.locator("button", { hasText: "操作" });
  const contractCount = await contractOps.count();
  console.log(`Contracts page: ${contractCount} 操作 buttons`);
  if (contractCount > 0) {
    await contractOps.first().click();
    await page.waitForTimeout(500);
    const items = page.locator('[role="menuitem"]');
    const itemCount = await items.count();
    for (let i = 0; i < itemCount; i++) {
      const text = await items.nth(i).textContent();
      console.log(`  menuitem[${i}]: "${text}"`);
    }
  }

  // 3. リード回答: 行クリックで詳細モーダル（別のアプローチ）
  await page.goto(`${BASE}/stp/lead-submissions`);
  await page.waitForTimeout(2500);
  // テーブル行の操作ボタンを探す
  const leadOps = page.locator("button", { hasText: "操作" });
  const leadCount = await leadOps.count();
  console.log(`Lead submissions: ${leadCount} 操作 buttons`);
  if (leadCount > 0) {
    await leadOps.first().click();
    await page.waitForTimeout(500);
    const items = page.locator('[role="menuitem"]');
    const itemCount = await items.count();
    for (let i = 0; i < itemCount; i++) {
      const text = await items.nth(i).textContent();
      console.log(`  menuitem[${i}]: "${text}"`);
      if (text?.includes("詳細")) {
        await items.nth(i).click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/lead-detail_1280.png`, fullPage: false });
        console.log("  -> captured lead-detail");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        break;
      }
    }
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUT}/`);
}

main().catch(console.error);
