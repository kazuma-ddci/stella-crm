import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "tmp/modal-ss-stage3";

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

  // 1. 代理店 契約書管理モーダル (contracts-modal.tsx)
  await page.goto(`${BASE}/stp/agents`);
  await page.waitForTimeout(2000);
  const agentOps = page.locator("button", { hasText: "操作" }).first();
  await agentOps.click();
  await page.waitForTimeout(500);
  const contractsItem = page.locator('[role="menuitem"]', { hasText: "契約書管理" });
  if (await contractsItem.isVisible()) {
    await contractsItem.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/agent-contracts_1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // 2. 企業 連絡先管理モーダル (contacts-modal.tsx)
  await page.goto(`${BASE}/companies`);
  await page.waitForTimeout(2000);
  // 企業行をクリックして詳細ページへ
  const companyLink = page.locator("table tbody tr td a").first();
  if (await companyLink.isVisible()) {
    await companyLink.click();
    await page.waitForTimeout(2000);
    // 連絡先管理ボタンを探す
    const contactsBtn = page.locator("button", { hasText: "連絡先" }).first();
    if (await contactsBtn.isVisible()) {
      await contactsBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/company-contacts_1280.png`, fullPage: false });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  }

  // 3. 記録 > 企業接触履歴 追加モーダル (company-contacts-table.tsx)
  await page.goto(`${BASE}/stp/records/company-contacts`);
  await page.waitForTimeout(2000);
  // 追加ボタンを探す
  const addBtn = page.locator("button", { hasText: "追加" }).first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/company-contact-add_1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // 4. リード回答 詳細モーダル (submissions-table.tsx)
  await page.goto(`${BASE}/stp/lead-submissions`);
  await page.waitForTimeout(2000);
  const submissionRow = page.locator("table tbody tr").first();
  if (await submissionRow.isVisible()) {
    await submissionRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/submission-detail_1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // 5. 契約書追加モーダル (contract-add-modal.tsx)
  await page.goto(`${BASE}/stp/contracts`);
  await page.waitForTimeout(2000);
  const contractAddBtn = page.locator("button", { hasText: "追加" }).first();
  if (await contractAddBtn.isVisible()) {
    await contractAddBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/contract-add_1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT}/`);
}

main().catch(console.error);
