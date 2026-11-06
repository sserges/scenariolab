import {
  expect,
  openStartupSimulation,
  playDecision,
  startStartupSimulation,
  test,
} from "./fixtures";

const themeKey = "scenariolab.theme";
const savedRunKey = "scenariolab.saved-run";

test("uses the operating system light and dark preferences on first visit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.evaluate((key) => localStorage.removeItem(key), themeKey);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.evaluate((key) => localStorage.removeItem(key), themeKey);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("manual theme choice persists after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to Dark Mode" }).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to Classic Mode" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), themeKey)).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to Classic Mode" })).toBeVisible();
});

test("switching theme during gameplay preserves the run and its saved decisions", async ({ page }) => {
  await startStartupSimulation(page);
  await playDecision(page, /Reduce Operating Expenses/);
  await expect(page.getByText("Month 2 of 12")).toBeVisible();
  const savedBeforeThemeChange = await page.evaluate(
    (key) => localStorage.getItem(key),
    savedRunKey,
  );

  await page.getByRole("button", { name: "Switch to Dark Mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Month 2 of 12")).toBeVisible();
  await expect(page.getByText("$127,500", { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), savedRunKey)).toBe(
    savedBeforeThemeChange,
  );

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Continue Saved Game" }).click();
  await expect(page.getByText("Month 2 of 12")).toBeVisible();
  await expect(page.getByText("$127,500", { exact: true })).toBeVisible();
});

test("keeps charts readable and captures desktop and mobile views in both themes", async ({ page }) => {
  await startStartupSimulation(page);
  await page.getByRole("radio", { name: /Reduce Operating Expenses/ }).check({ force: true });

  for (const theme of ["light", "dark"] as const) {
    const currentTheme = await page.locator("html").getAttribute("data-theme");
    if (currentTheme !== theme) {
      await page.getByRole("button", {
        name: theme === "dark" ? "Switch to Dark Mode" : "Switch to Classic Mode",
      }).click();
    }

    const palette = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        background: root.getPropertyValue("--theme-background").trim(),
        surface: root.getPropertyValue("--theme-surface").trim(),
        secondary: root.getPropertyValue("--theme-secondary").trim(),
        focus: root.getPropertyValue("--theme-focus").trim(),
      };
    });
    expect(palette.background).toBe(theme === "dark" ? "#151518" : "#f5f5f7");
    expect(palette.surface).toBe(theme === "dark" ? "#242428" : "#ffffff");
    await expect.poll(() =>
      page.locator('figure[aria-labelledby]').first().evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe(theme === "dark" ? "rgb(36, 36, 40)" : "rgb(255, 255, 255)");

    const contrast = await page.evaluate(() => {
      function luminance(color: string): number {
        const hex = color.trim().match(/^#([\da-f]{6})$/i)?.[1];
        if (hex !== undefined) {
          color = `rgb(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)})`;
        }
        const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        if (values === undefined || values.length !== 3) return 0;
        const [r, g, b] = values.map((part) => {
          const channel = part / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      }
      function ratio(first: string, second: string): number {
        const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return (values[0]! + 0.05) / (values[1]! + 0.05);
      }

      const root = getComputedStyle(document.documentElement);
      const main = document.querySelector("main")!;
      const paragraph = main.querySelector(".text-secondary")!;
      const chartPath = document.querySelector('svg[role="img"] path')!;
      const card = document.querySelector('figure[aria-labelledby]')!;
      const action = [...document.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Confirm Decision"),
      )!;
      const stroke = getComputedStyle(chartPath).stroke;
      const chartSeriesColor = stroke.startsWith("var(")
        ? root.getPropertyValue("--theme-chart-series-1").trim()
        : stroke;
      const semanticTextColors = ["accent-text", "warning", "danger", "success", "briefing"]
        .map((name) => root.getPropertyValue(`--theme-${name}`).trim());
      return {
        secondary: ratio(getComputedStyle(paragraph).color, root.backgroundColor),
        chartSeries: ratio(chartSeriesColor, getComputedStyle(card).backgroundColor),
        action: ratio(getComputedStyle(action).color, getComputedStyle(action).backgroundColor),
        semanticText: semanticTextColors.map((color) => ratio(color, root.backgroundColor)),
      };
    });
    expect(contrast.secondary).toBeGreaterThanOrEqual(4.5);
    expect(contrast.chartSeries).toBeGreaterThanOrEqual(3);
    expect(contrast.action).toBeGreaterThanOrEqual(4.5);
    expect(contrast.semanticText.every((ratio) => ratio >= 4.5)).toBe(true);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.getByRole("img", { name: "Financial trends" })).toBeVisible();
    await page.screenshot({ path: `test-results/theme-${theme}-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("img", { name: "Financial trends" })).toBeVisible();
    await page.screenshot({ path: `test-results/theme-${theme}-mobile.png`, fullPage: true });
  }
});

test("shows a distinct accessible keyboard focus indicator in both themes", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark"] as const) {
    if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
      await page.getByRole("button", {
        name: theme === "dark" ? "Switch to Dark Mode" : "Switch to Classic Mode",
      }).click();
    }

    const toggle = page.getByRole("button", {
      name: theme === "dark" ? "Switch to Classic Mode" : "Switch to Dark Mode",
    });
    await page.getByRole("link", { name: "ScenarioLab home" }).evaluate((element) => {
      (element as HTMLElement).focus({ preventScroll: true });
    });
    await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    const focusStyle = await toggle.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
    });
    expect(focusStyle).toMatchObject({ width: "3px", style: "solid" });
    const focusContrast = await toggle.evaluate((element) => {
      function luminance(color: string): number {
        const hex = color.trim().match(/^#([\da-f]{6})$/i)?.[1];
        if (hex !== undefined) {
          color = `rgb(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)})`;
        }
        const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        if (values === undefined || values.length !== 3) return 0;
        const [r, g, b] = values.map((part) => {
          const channel = part / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      }
      const outline = luminance(getComputedStyle(element).outlineColor);
      const background = luminance(getComputedStyle(document.documentElement).backgroundColor);
      return (Math.max(outline, background) + 0.05) / (Math.min(outline, background) + 0.05);
    });
    expect(focusContrast).toBeGreaterThanOrEqual(3);
  }
});

test("the theme control remains available in the scenario detail and gameplay screen", async ({ page }) => {
  await openStartupSimulation(page);
  await expect(page.getByRole("button", { name: "Switch to Dark Mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Dark Mode" }).click();
  await page.getByRole("button", { name: "Switch to Classic Mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
