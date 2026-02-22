import { chromium, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const VIEWPORTS = [
  { width: 390, height: 844, name: "390" },
  { width: 768, height: 1024, name: "768" },
  { width: 1024, height: 768, name: "1024" },
  { width: 1280, height: 800, name: "1280" },
  { width: 1536, height: 864, name: "1536" },
  { width: 1920, height: 1080, name: "1920" },
];

const PHASE = process.argv[2] || "before";
const OUT_DIR = path.join(__dirname, "..", "tmp", `modal-ss-${PHASE}`);

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
      await page.goto(`${BASE_URL}/stp/companies`, { waitUntil: "domcontentloaded", timeout: 30000 });
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
  // CrudTable の「操作」ドロップダウンを開く（最初の行）
  const opBtn = page.locator('table tbody tr').first().locator('button', { hasText: '操作' }).first();
  await opBtn.click();
  await page.waitForTimeout(400);
  // ドロップダウンメニューのアイテムをクリック
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

    if (vp.width >= 768) {
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
    } else {
      // モバイル
      await page.goto(pageUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await openFn(page);
      await takeScreenshot(page, `${modalName}_${vp.name}_mobile`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }
}

async function main() {
  ensureDir(OUT_DIR);
  console.log(`\n=== Modal Screenshots (${PHASE}) ===`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await login(page);

    // 1. Stage Management Modal (/stp/companies → 操作 → パイプライン管理)
    console.log("[1/4] Stage Management Modal");
    await captureModalAtViewports(
      page,
      "stage-management",
      `${BASE_URL}/stp/companies`,
      async (p) => openCrudTableAction(p, "パイプライン管理")
    );

    // 2. Contract Status Modal (/stp/contracts → gear icon)
    console.log("[2/4] Contract Status Modal");
    await captureModalAtViewports(
      page,
      "contract-status",
      `${BASE_URL}/stp/contracts`,
      async (p) => {
        const gearBtn = p.locator('button[title="ステータス管理"]').first();
        await gearBtn.click();
        await p.waitForTimeout(800);
      }
    );

    // 3. Contact History Modal - Companies (/stp/companies → 操作 → 接触履歴)
    console.log("[3/4] Contact History Modal (companies)");
    await captureModalAtViewports(
      page,
      "contact-history-company",
      `${BASE_URL}/stp/companies`,
      async (p) => openCrudTableAction(p, "接触履歴")
    );

    // 4. Contact History Modal - Agents (/stp/agents → 操作 → 接触履歴)
    console.log("[4/4] Contact History Modal (agents)");
    await captureModalAtViewports(
      page,
      "contact-history-agent",
      `${BASE_URL}/stp/agents`,
      async (p) => openCrudTableAction(p, "接触履歴")
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
