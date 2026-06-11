import { expect, test } from "@playwright/test";

test("statistics can be explored by participant and group", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Huvudvyer")
    .getByRole("button", { name: "Statistik" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Ditt tips mot kollektivet" }),
  ).toBeVisible();

  const participantPicker = page.getByLabel("Välj dina initialer");
  await participantPicker.selectOption({ index: 1 });
  await expect(page.getByText("Dina mest ovanliga val")).toBeVisible();

  await page
    .getByLabel("Välj överraskningar")
    .getByRole("button", { name: "Gruppspel" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ovanliga gruppval" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Grupp F", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Grupp F" })).toBeVisible();
});

test("statistics fits a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByLabel("Huvudvyer")
    .getByRole("button", { name: "Statistik" })
    .click();
  await page.getByLabel("Välj dina initialer").selectOption({ index: 1 });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
