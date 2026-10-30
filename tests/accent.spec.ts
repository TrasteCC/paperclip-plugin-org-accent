// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULTS,
  RANGES,
  ROOT_ATTRIBUTE,
  SHELL_SELECTOR,
  SIDEBAR_SELECTOR,
  STYLE_ELEMENT_ID,
  applyAccent,
  clampPercent,
  createPreview,
  normalizeColor,
  readableTextColor,
  removeAccent,
  resolveConfig,
} from "../src/accent.js";

const styleEl = () => document.getElementById(STYLE_ELEMENT_ID);
const css = () => styleEl()?.textContent ?? "";

describe("applyAccent / removeAccent", () => {
  afterEach(() => removeAccent());

  it("injects one scoped style element targeting the host shell", () => {
    applyAccent({ accentColor: "#C05621", textColor: "#FFFFFF" }, "Acme Corp");
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    expect(css()).toContain("--org-accent: #c05621");
    expect(css()).toContain("--org-accent-text: #ffffff");
    expect(css()).toContain('content: "Acme Corp"');
    expect(css()).toContain('div:has(> a[href="#main-content"]) aside:has(> nav)');
    expect(css()).toContain("border-right: 3px solid var(--org-accent)");
    expect(css()).toContain("color-mix(in srgb, var(--org-accent) 5%, oklch(1 0 0))");
    expect(css()).toContain("color-mix(in srgb, var(--org-accent) 22%, transparent)");
    expect(css()).toContain('.dark div:has(> a[href="#main-content"])');
    expect(document.documentElement.getAttribute(ROOT_ATTRIBUTE)).toBe("#c05621");
  });

  it("replaces the style on re-apply instead of stacking", () => {
    applyAccent({ accentColor: "#C05621", textColor: null }, "A");
    applyAccent({ accentColor: "#2F855A", textColor: null }, "B");
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    expect(css()).toContain("--org-accent: #2f855a");
  });

  it("removes everything it added", () => {
    applyAccent({ accentColor: "#3182CE", textColor: "#0A1F33" }, "Example Org");
    removeAccent();
    expect(styleEl()).toBeNull();
    expect(document.documentElement.hasAttribute(ROOT_ATTRIBUTE)).toBe(false);
  });

  it("applies no tint when no accent color is set", () => {
    applyAccent({ accentColor: "#3182CE", textColor: null }, "X");
    applyAccent({ accentColor: null, textColor: "#ffffff" }, "X");
    expect(styleEl()).toBeNull();
  });

  it("escapes the org name and rejects non-hex colors", () => {
    applyAccent({ accentColor: "#3182CE", textColor: "red;}body{display:none" }, 'Evil" } body { x');
    expect(css()).toContain('content: "Evil\\" } body { x"');
    expect(css()).not.toContain("display:none");
    expect(normalizeColor("url(x)")).toBeNull();
  });

  it("picks readable automatic text colors", () => {
    expect(readableTextColor("#c05621")).toBe("#ffffff");
    expect(readableTextColor("#2f855a")).toBe("#ffffff");
    expect(readableTextColor("#00aaff")).toBe("#111111");
  });
});

describe("appearance settings", () => {
  afterEach(() => removeAccent());

  it("uses the stored tint percentages", () => {
    applyAccent({ accentColor: "#3182CE", textColor: null, backgroundTint: 12, navTint: 35 }, "X");
    expect(css()).toContain("var(--org-accent) 12%, oklch(1 0 0)");
    expect(css()).toContain("var(--org-accent) 12%, oklch(0.205 0 0)");
    expect(css()).toContain("var(--org-accent) 35%, transparent");
  });

  it("drops the band and the sidebar edge when toggled off", () => {
    applyAccent({ accentColor: "#3182CE", textColor: null, showBand: false, showSidebarEdge: false }, "X");
    expect(css()).not.toContain("::before");
    expect(css()).not.toContain("border-right");
    expect(css()).toContain("--org-accent: #3182ce");
  });

  it("leaves host defaults alone at 0%", () => {
    applyAccent({ accentColor: "#3182CE", textColor: null, backgroundTint: 0, navTint: 0 }, "X");
    expect(css()).not.toContain("--background:");
    expect(css()).not.toContain("aria-current");
  });

  it("clamps percentages to integers in range and rejects junk", () => {
    expect(clampPercent(7.6, RANGES.backgroundTint, 5)).toBe(8);
    expect(clampPercent(99, RANGES.backgroundTint, 5)).toBe(20);
    expect(clampPercent(-3, RANGES.navTint, 22)).toBe(0);
    expect(clampPercent(55, RANGES.navTint, 22)).toBe(40);
    expect(clampPercent("12", RANGES.navTint, 22)).toBe(12);
    expect(clampPercent("12%; } body { x", RANGES.navTint, 22)).toBe(22);
    expect(clampPercent(Number.NaN, RANGES.navTint, 22)).toBe(22);
    expect(clampPercent(null, RANGES.navTint, 22)).toBe(22);
    applyAccent({ accentColor: "#3182CE", textColor: null, backgroundTint: "5%; } body { x" as unknown as number }, "X");
    expect(css()).not.toContain("body { x");
  });

  it("treats old records (colors only) as defaults", () => {
    expect(resolveConfig({ accentColor: "#3182CE", textColor: "#FFFFFF" })).toEqual({
      accentColor: "#3182ce",
      textColor: "#ffffff",
      ...DEFAULTS,
    });
    expect(resolveConfig({ accentColor: "#3182CE", textColor: null, showBand: "no" as unknown as boolean }).showBand).toBe(true);
  });
});

describe("live preview", () => {
  afterEach(() => removeAccent());

  it("paints drafts and reverts to the saved values", () => {
    const saved = { accentColor: "#C05621", textColor: null, backgroundTint: 5 };
    applyAccent(saved, "X");
    const preview = createPreview(saved, "X");
    preview.update({ accentColor: "#2F855A", textColor: null, backgroundTint: 15, showBand: false });
    expect(css()).toContain("--org-accent: #2f855a");
    expect(css()).not.toContain("::before");
    preview.revert();
    expect(css()).toContain("--org-accent: #c05621");
    expect(css()).toContain("var(--org-accent) 5%, oklch(1 0 0)");
    expect(css()).toContain("::before");
  });

  it("reverts to no tint when nothing was saved", () => {
    const preview = createPreview(null, "X");
    preview.update({ accentColor: "#2F855A", textColor: null });
    expect(styleEl()).not.toBeNull();
    preview.revert();
    expect(styleEl()).toBeNull();
  });

  it("reverts to the last committed values after a save", () => {
    const preview = createPreview({ accentColor: "#C05621", textColor: null }, "X");
    preview.commit({ accentColor: "#2F855A", textColor: null, navTint: 30 });
    preview.update({ accentColor: "#3182CE", textColor: null });
    preview.revert();
    expect(css()).toContain("--org-accent: #2f855a");
    expect(css()).toContain("var(--org-accent) 30%, transparent");
  });
});

// Trimmed shell markup: 2026.1012.0 (Layout.production.tsx @ bba6a45) has no
// shell classes; upstream 8035f8b adds .paperclip-app-shell / .app-main-row.
const DEPLOYED_SHELL = `
  <div class="bg-background text-foreground flex h-dvh flex-col">
    <a href="#main-content" class="sr-only">Skip to Main Content</a>
    <div class="min-h-0 flex-1 flex">
      <aside class="border-r border-border bg-background"><div>Org</div>
        <nav><a class="bg-accent" aria-current="page">Dashboard</a><a>Issues</a></nav></aside>
      <div><main id="main-content"></main></div>
    </div>
    <aside class="plugin-app-shell-overlays"></aside>
  </div>`;
const UPSTREAM_SHELL = DEPLOYED_SHELL
  .replace('class="bg-background', 'class="paperclip-app-shell bg-background')
  .replace('class="min-h-0 flex-1 flex"', 'class="app-main-row min-h-0 flex-1 flex"');

describe.each([
  ["deployed 2026.1012.0", DEPLOYED_SHELL],
  ["upstream 8035f8b", UPSTREAM_SHELL],
])("selectors on %s markup", (_name, markup) => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("finds exactly the shell root, the primary sidebar and its active item", () => {
    document.body.innerHTML = markup;
    const shells = document.querySelectorAll(SHELL_SELECTOR);
    expect(shells).toHaveLength(1);
    expect(shells[0].firstElementChild?.getAttribute("href")).toBe("#main-content");
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    expect(sidebars).toHaveLength(1);
    expect(sidebars[0].classList.contains("plugin-app-shell-overlays")).toBe(false);
    expect(document.querySelectorAll(`${SIDEBAR_SELECTOR} nav a[aria-current="page"]`)).toHaveLength(1);
  });
});
