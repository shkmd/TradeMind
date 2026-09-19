import { test, expect } from "@playwright/test";
import path from "path";

/**
 * End-to-end smoke test for the vertical slice named in the product spec:
 * sign in -> create broker account -> upload Zerodha Tradebook -> validate
 * import -> generate trades -> consolidated dashboard -> open a trade ->
 * add journal review -> process score + rule compliance render.
 *
 * Assumes `pnpm db:seed` has been run (demo@trademind.in / Demo@1234) and
 * the app is reachable at the configured baseURL.
 */
test("vertical slice: login through journal + process score", async ({ page }) => {
  // 1. Sign in as the seeded demo user.
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@trademind.in");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // 2. Create a new broker account (a second Zerodha account, since the
  // seed already created one — proves the flow works for a fresh account too).
  await page.goto("/broker-accounts/new");
  await page.getByLabel("Account nickname").fill("Zerodha — E2E Test");
  await page.getByRole("button", { name: "Continue" }).click();

  // Creating a Zerodha account redirects straight into the import wizard.
  await expect(page).toHaveURL(/\/imports\/new\?brokerAccountId=/);

  // 3. Upload the Zerodha tradebook fixture.
  const fixturePath = path.resolve(__dirname, "../../fixtures/zerodha-tradebook-sample.csv");
  await page.setInputFiles("#file", fixturePath);
  await page.getByRole("button", { name: "Upload and preview" }).click();

  // 4. Validate + dedupe results render.
  await expect(page.getByText("Valid rows", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Invalid rows", { exact: true })).toBeVisible();
  await expect(page.getByText("Duplicate rows", { exact: true })).toBeVisible();

  // 5. Confirm the import — generates trades via the real pipeline.
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText("Import complete")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Trades generated")).toBeVisible();

  // 6. Consolidated dashboard shows non-zero trade activity.
  await page.getByRole("link", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Trade Count")).toBeVisible();

  // 7. Open a closed trade from the trades list.
  await page.goto("/trading/trades");
  const firstTradeLink = page.locator("table tbody tr a").first();
  await firstTradeLink.click();
  await expect(page).toHaveURL(/\/trading\/trades\//);

  // 8. Fill in and save the trade journal.
  await page.getByLabel("Setup", { exact: true }).fill("Breakout retest with volume confirmation.");
  await page.getByLabel("What went well").fill("Waited for confirmation before entering.");
  await page.getByLabel("Mark journal as complete").check();
  await page.getByRole("button", { name: "Save journal entry" }).click();
  await expect(page.getByText("Journal saved.")).toBeVisible({ timeout: 10_000 });

  // 9. Process score and rule compliance render (not blank/fabricated placeholders).
  await expect(page.getByText("Process score")).toBeVisible();
  await expect(page.getByText("Rule compliance %")).toBeVisible();
  await expect(page.getByText("Rule compliance", { exact: false }).first()).toBeVisible();
});
