const { chromium } = require("playwright");
const assert = require("node:assert/strict");
require("node:fs").mkdirSync(".playwright", { recursive: true });
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByText("Your team's").count();
  await page.screenshot({ path: ".playwright/landing.png", fullPage: true });
  await page.getByRole("button", { name: "Explore live demo" }).click();
  await page
    .getByRole("heading", { name: "Good things come in small tools." })
    .waitFor();
  await page.screenshot({ path: ".playwright/workspace.png", fullPage: true });
  console.log("Workspace loaded");
  await page
    .getByRole("button", { name: "Create a tool", exact: true })
    .first()
    .click();
  await page.getByLabel("Tool name").fill("Browser test tool");
  await page.getByRole("button", { name: "Create tool", exact: true }).click();
  await page.getByRole("heading", { name: "Browser test tool" }).waitFor();
  console.log("Tool created");
  await page
    .getByRole("button", { name: "Add record", exact: true })
    .first()
    .click();
  await page.getByLabel("Expense *", { exact: true }).fill("Office supplies");
  await page.getByLabel("Submitted by").fill("Browser tester");
  await page.getByLabel("Amount (USD)").fill("35.75");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add record", exact: true })
    .click();
  await page
    .getByRole("cell", { name: "Office supplies", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Edit Office supplies" }).click();
  await page.getByLabel(/Status/).selectOption("Approved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("cell", { name: "Approved", exact: true }).waitFor();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  assert.match((await download).suggestedFilename(), /Browser-test-tool.csv/);
  console.log("Records and export passed");
  await page.getByRole("button", { name: "Share tool" }).click();
  await page.getByRole("button", { name: "Enable sharing link" }).click();
  const link = await page.getByLabel("Shareable link").inputValue();
  const guest = await browser.newPage();
  guest.setDefaultTimeout(8000);
  await guest.goto(link);
  await guest
    .getByRole("cell", { name: "Office supplies", exact: true })
    .waitFor();
  assert.equal(
    await guest.getByRole("button", { name: "Add record" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Revoke link access" }).click();
  await page.getByText("This tool is private", { exact: true }).waitFor();
  await guest.reload();
  await guest
    .getByRole("heading", { name: "This parcel is unavailable" })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Delete tool", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete tool", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Good things come in small tools." })
    .waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".playwright/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile overflow",
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page
    .getByRole("heading", { name: "A small start. A big head start." })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop, mobile, create/edit/export/share/revoke/delete, navigation, no console errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
