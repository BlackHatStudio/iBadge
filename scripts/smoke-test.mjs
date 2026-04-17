#!/usr/bin/env node
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 20_000);

async function run() {
  const browser = await chromium.launch({
    headless: process.env.SMOKE_HEADLESS === "false" ? false : true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    await page.waitForSelector("h1", { timeout: timeoutMs });
    await page.waitForSelector('input[id="badge"]', { timeout: timeoutMs });
    await page.waitForSelector('button:has-text("Admin")', { timeout: timeoutMs });

    const titleText = (await page.textContent("h1"))?.trim() || "";
    if (!titleText) {
      throw new Error("Smoke test failed: kiosk heading is empty.");
    }

    // Ensure admin PIN page loads in browser context.
    await page.goto(`${baseUrl}/admin/access`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForSelector('input[id="pin"]', { timeout: timeoutMs });

    console.log(`[smoke-test] PASS against ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error("[smoke-test] FAIL", error);
  process.exitCode = 1;
});
