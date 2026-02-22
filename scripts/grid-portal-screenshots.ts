import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const VIEWPORTS = [
  { width: 768, height: 1024, name: "768" },
  { width: 1280, height: 800, name: "1280" },
  { width: 1920, height: 1080, name: "1920" },
];

const PHASE = process.argv[2] || "before";
const OUT_DIR = path.join(__dirname, "..", "tmp", `grid-portal-${PHASE}`);

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", "yamamoto@example.com");
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  } catch {
    if (page.url().includes("/login")) {
      await page.goto(`${BASE_URL}/stp/agents`, { waitUntil: "domcontentloaded", timeout: 30000 });
    }
  }
  await page.waitForTimeout(2000);
  console.log("Logged in, URL:", page.url());
}

async function setSidebarState(page: Page, collapsed: boolean) {
  await page.evaluate((c) => localStorage.setItem("sidebar-collapsed", String(c)), collapsed);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
}

async function takeScreenshot(page: Page, name: string) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`  📸 ${name}`);
}

async function openCrudTableAction(page: Page, actionLabel: string) {
  const opBtn = page.locator('table tbody tr').first().locator('button', { hasText: '操作' }).first();
  await opBtn.click();
  await page.waitForTimeout(400);
  const menuItem = page.locator('[role="menuitem"]', { hasText: actionLabel }).first();
  await menuItem.click();
  await page.waitForTimeout(800);
}

async function captureModalAtViewports(
  page: Page,
  modalName: string,
  pageUrl: string,
  openFn: (page: Page) => Promise<void>
) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // サイドバー展開
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await setSidebarState(page, false);
    await openFn(page);
    await takeScreenshot(page, `${modalName}_${vp.name}_sidebar-open`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // サイドバー折畳
    await setSidebarState(page, true);
    await openFn(page);
    await takeScreenshot(page, `${modalName}_${vp.name}_sidebar-closed`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function main() {
  ensureDir(OUT_DIR);
  console.log(`\n=== Grid Portal Modal Screenshots (${PHASE}) ===`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await login(page);

    // 契約書管理モーダル (agents → 操作 → 契約書)
    console.log("[1/1] MasterContract Modal (agents)");
    await captureModalAtViewports(
      page,
      "master-contract",
      `${BASE_URL}/stp/agents`,
      async (p) => openCrudTableAction(p, "契約書")
    );

    console.log(`\n✅ All screenshots saved to ${OUT_DIR}`);
  } catch (e) {
    console.error("Error:", e);
    await page.screenshot({ path: path.join(OUT_DIR, "_error.png") });
  } finally {
    await browser.close();
  }
}

main();
