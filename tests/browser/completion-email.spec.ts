import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { completionTemplate } from "../../src/completion-email.js";

for (const role of ["customer", "owner"] as const) {
  test(`responsive HTML/text completion template for ${role}`, async ({ page }, testInfo) => {
    const name = 'Local Reviewer & "Guest"';
    const equipment = "Camera <script>alert(1)</script> & <img src=x onerror=alert(1)>";
    const message = completionTemplate(name, equipment, role);
    const sentence = role === "owner"
      ? `The rental of your equipment, ${equipment}, has completed.`
      : `Your rental of ${equipment} has completed.`;

    expect(message.subject).toBe("Your Equipora rental is complete");
    expect(message.text).toContain(`Hello ${name},`);
    expect(message.text).toContain(sentence);
    expect(message.text).toContain("review your rental history");
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&lt;img");
    expect(message.html).toContain("&amp;");
    expect(message.html).toContain("&quot;Guest&quot;");
    expect(message.html).toContain('name="viewport"');
    expect(message.html).toContain("@media(max-width:600px)");

    for (const width of [390, 834, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(message.html);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your rental is complete.");
      await expect(page.getByText(sentence, { exact: true })).toBeVisible();
      await expect(page.locator("script,img,iframe,object,embed")).toHaveCount(0);
      await expect(page.locator("table")).toHaveCount(2);
      for (const table of await page.locator("table").all())
        await expect(table).toHaveAttribute("role", "presentation");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(accessibility.violations.map(v => v.id)).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`completion-${role}-${width}.png`), fullPage: true });
    }
  });
}
