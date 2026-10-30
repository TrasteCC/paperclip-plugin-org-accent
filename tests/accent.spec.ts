// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULTS,
  HEADER_SELECTOR,
  MOBILE_NAV_SELECTOR,
  PRESETS,
  RANGES,
  ROOT_ATTRIBUTE,
  SHELL_SELECTOR,
  SIDEBAR_SELECTOR,
  STYLE_ELEMENT_ID,
  applyAccent,
  clampPercent,
  createPreview,
  effectiveAppearance,
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
    applyAccent({ accentColor: "#C05621", textColor: "#FFFFFF" });
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    expect(css()).toContain("--org-accent: #c05621");
    expect(css()).toContain("--org-accent-text: #ffffff");
    expect(css()).toContain(`${SIDEBAR_SELECTOR} {\n  box-shadow: inset 0 3px 0 var(--org-accent), inset -3px 0 0 var(--org-accent);`);
    expect(css()).toContain("color-mix(in srgb, var(--org-accent) 5%, oklch(1 0 0))");
    expect(css()).toContain("color-mix(in srgb, var(--org-accent) 22%, transparent)");
    expect(css()).toContain(`.dark ${SHELL_SELECTOR}`);
    expect(document.documentElement.getAttribute(ROOT_ATTRIBUTE)).toBe("#c05621");
  });

  it("accents the top bar and mobile nav without changing layout", () => {
    applyAccent({ accentColor: "#C05621", textColor: null });
    expect(css()).toContain(`${HEADER_SELECTOR} {\n  background-color: color-mix(in srgb, var(--org-accent) 10%, var(--background));\n}`);
    expect(css()).toContain(`${MOBILE_NAV_SELECTOR} {\n  background-color: color-mix(in srgb, var(--org-accent) 12%, var(--muted));\n  box-shadow: inset 0 3px 0 var(--org-accent);`);
    expect(css()).toContain(`${MOBILE_NAV_SELECTOR} a[aria-current="page"] {\n  color: var(--org-accent);`);
    // No band, no pseudo-element content, nothing that sizes or moves elements.
    expect(css()).not.toContain("::before");
    expect(css()).not.toMatch(/\b(height|width|margin|padding|top|position|border(-[a-z]+)?):/);
  });

  it("replaces the style on re-apply instead of stacking", () => {
    applyAccent({ accentColor: "#C05621", textColor: null });
    applyAccent({ accentColor: "#2F855A", textColor: null });
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    expect(css()).toContain("--org-accent: #2f855a");
  });

  it("removes everything it added, header and mobile nav rules included", () => {
    applyAccent({ accentColor: "#3182CE", textColor: "#0A1F33" });
    expect(css()).toContain(HEADER_SELECTOR);
    expect(css()).toContain(MOBILE_NAV_SELECTOR);
    removeAccent();
    expect(styleEl()).toBeNull();
    expect(document.documentElement.hasAttribute(ROOT_ATTRIBUTE)).toBe(false);
  });

  it("applies no tint when no accent color is set", () => {
    applyAccent({ accentColor: "#3182CE", textColor: null });
    applyAccent({ accentColor: null, textColor: "#ffffff" });
    expect(styleEl()).toBeNull();
  });

  it("rejects non-hex colors", () => {
    applyAccent({ accentColor: "#3182CE", textColor: "red;}body{display:none" });
    expect(css()).not.toContain("display:none");
    expect(normalizeColor("url(x)")).toBeNull();
  });

  it("picks readable automatic text colors", () => {
    expect(readableTextColor("#c05621")).toBe("#ffffff");
    expect(readableTextColor("#2f855a")).toBe("#ffffff");
    expect(readableTextColor("#00aaff")).toBe("#111111");
  });
});

describe("custom appearance settings", () => {
  afterEach(() => removeAccent());

  it("uses the stored tint percentages", () => {
    applyAccent({ accentColor: "#3182CE", backgroundTint: 12, navTint: 35 });
    expect(css()).toContain("var(--org-accent) 12%, oklch(1 0 0)");
    expect(css()).toContain("var(--org-accent) 12%, oklch(0.205 0 0)");
    expect(css()).toContain("var(--org-accent) 35%, transparent");
  });

  it("drops the top bar, sidebar edge and mobile nav accents when toggled off", () => {
    applyAccent({ accentColor: "#3182CE", showBand: false, showSidebarEdge: false, showMobileNav: false });
    expect(css()).not.toContain(HEADER_SELECTOR);
    expect(css()).not.toContain("inset -3px");
    expect(css()).not.toContain(MOBILE_NAV_SELECTOR);
    expect(css()).toContain("--org-accent: #3182ce");
  });

  it("draws the top line on the sidebar only, independent of the sidebar edge", () => {
    applyAccent({ accentColor: "#3182CE", showSidebarEdge: false });
    expect(css()).toContain(`${SIDEBAR_SELECTOR} {\n  box-shadow: inset 0 3px 0 var(--org-accent);\n}`);
    expect(css()).not.toMatch(new RegExp(`${HEADER_SELECTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{[^}]*box-shadow`));
    applyAccent({ accentColor: "#3182CE", showBand: false });
    expect(css()).toContain(`${SIDEBAR_SELECTOR} {\n  box-shadow: inset -3px 0 0 var(--org-accent);\n}`);
    expect(css()).not.toContain(HEADER_SELECTOR);
  });

  it("leaves host defaults alone at 0%", () => {
    applyAccent({ accentColor: "#3182CE", backgroundTint: 0, navTint: 0 });
    expect(css()).not.toContain("--background:");
    expect(css()).not.toContain("a.bg-accent");
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
    applyAccent({ accentColor: "#3182CE", backgroundTint: "5%; } body { x" });
    expect(css()).not.toContain("body { x");
  });
});

describe("modes and presets", () => {
  afterEach(() => removeAccent());

  it("ships the eight approved presets, white text except Sky", () => {
    expect(Object.keys(PRESETS)).toEqual(["amber", "green", "sky", "blue", "violet", "teal", "coral", "slate"]);
    expect(PRESETS.amber.accentColor).toBe("#ba7517");
    expect(PRESETS.sky).toMatchObject({ accentColor: "#00aaff", textColor: "#04263a" });
    for (const [name, preset] of Object.entries(PRESETS)) {
      if (name !== "sky") expect(preset.textColor).toBe("#ffffff");
    }
  });

  it("default mode paints the preset with every tunable at its default", () => {
    const settings = resolveConfig({
      mode: "default",
      preset: "teal",
      accentColor: "#C05621",
      backgroundTint: 18,
      navTint: 3,
      showBand: false,
      showSidebarEdge: false,
      showMobileNav: false,
    });
    expect(effectiveAppearance(settings)).toEqual({ accentColor: "#0f6e56", textColor: "#ffffff", ...DEFAULTS });
    applyAccent(settings);
    expect(css()).toContain("--org-accent: #0f6e56");
    expect(css()).toContain("var(--org-accent) 5%, oklch(1 0 0)");
    expect(css()).toContain(HEADER_SELECTOR);
    expect(css()).toContain(MOBILE_NAV_SELECTOR);
    // Custom values are kept for when the user switches back.
    expect(settings.backgroundTint).toBe(18);
  });

  it("follows the preset by name, so retuning a preset updates every org using it", () => {
    const settings = resolveConfig({ mode: "default", preset: "blue" });
    expect(effectiveAppearance(settings).accentColor).toBe(PRESETS.blue.accentColor);
    expect(settings).not.toHaveProperty("accentColor", PRESETS.blue.accentColor);
  });

  it("loads records without mode (v0.1/v0.2) as Custom with defaults", () => {
    expect(resolveConfig({ accentColor: "#3182CE", textColor: "#FFFFFF" })).toEqual({
      mode: "custom",
      preset: null,
      accentColor: "#3182ce",
      textColor: "#ffffff",
      ...DEFAULTS,
    });
    const v02 = resolveConfig({ accentColor: "#3182CE", textColor: null, backgroundTint: 9, showBand: false });
    expect(v02).toMatchObject({ mode: "custom", backgroundTint: 9, showBand: false, showMobileNav: true });
  });

  it("rejects unknown presets and modes", () => {
    expect(resolveConfig({ mode: "default", preset: "__proto__" })).toMatchObject({ mode: "custom", preset: null });
    expect(resolveConfig({ mode: "default", preset: "hotpink" })).toMatchObject({ mode: "custom", preset: null });
    expect(resolveConfig({ mode: "fancy", preset: "amber" })).toMatchObject({ mode: "custom", preset: "amber" });
  });
});

describe("live preview", () => {
  afterEach(() => removeAccent());

  it("paints drafts and reverts to the saved values", () => {
    const saved = { accentColor: "#C05621", backgroundTint: 5 };
    applyAccent(saved);
    const preview = createPreview(saved);
    preview.update({ mode: "default", preset: "violet" });
    expect(css()).toContain("--org-accent: #534ab7");
    preview.update({ accentColor: "#2F855A", backgroundTint: 15, showMobileNav: false });
    expect(css()).toContain("--org-accent: #2f855a");
    expect(css()).not.toContain(MOBILE_NAV_SELECTOR);
    preview.revert();
    expect(css()).toContain("--org-accent: #c05621");
    expect(css()).toContain("var(--org-accent) 5%, oklch(1 0 0)");
    expect(css()).toContain(MOBILE_NAV_SELECTOR);
  });

  it("reverts to no tint when nothing was saved", () => {
    const preview = createPreview(null);
    preview.update({ accentColor: "#2F855A" });
    expect(styleEl()).not.toBeNull();
    preview.revert();
    expect(styleEl()).toBeNull();
  });

  it("reverts to the last committed values after a save", () => {
    const preview = createPreview({ accentColor: "#C05621" });
    preview.commit({ mode: "default", preset: "coral" });
    preview.update({ accentColor: "#3182CE" });
    preview.revert();
    expect(css()).toContain("--org-accent: #d85a30");
  });
});

// Trimmed shell markup from Layout.production.tsx / Layout.tsx / MobileBottomNav.tsx.
// 2026.1012.0 (bba6a45) has no shell classes; upstream 8035f8b adds
// .paperclip-app-shell / .app-main-row / .app-breadcrumb.
const shell = (contentRow: string) => `
  <div class="bg-background text-foreground flex h-dvh flex-col">
    <a href="#main-content" class="sr-only">Skip to Main Content</a>
    <div class="min-h-0 flex-1 flex">
      <div class="relative h-full shrink-0"><div>
        <aside class="border-r border-border bg-background"><div>Org</div>
          <nav><a class="bg-accent" aria-current="page">Dashboard</a><a>Issues</a></nav></aside>
      </div></div>
      <div class="flex min-w-0 flex-col h-full flex-1">
        <div class="header-wrapper"><div class="border-b border-border h-12">Dashboard</div></div>
        ${contentRow}
      </div>
    </div>
    <nav class="mobile-bottom-nav fixed bottom-0" aria-label="Mobile navigation">
      <div class="grid h-16"><a aria-current="page">Home</a><a>Tasks</a><button>New Task</button></div>
    </nav>
    <aside class="plugin-app-shell-overlays"></aside>
  </div>`;
const PRODUCTION = shell('<div class="flex flex-1 min-h-0"><main id="main-content"></main><div>panel</div></div>');
// Streamlined Layout.tsx nests <main> one level deeper (a display:contents wrapper).
const STREAMLINED = shell('<div class="flex flex-1 min-h-0"><div class="contents"><main id="main-content"></main></div></div>');
const upstream = (markup: string) => markup
  .replace('class="bg-background text-foreground', 'class="paperclip-app-shell bg-background text-foreground')
  .replace('class="min-h-0 flex-1 flex"', 'class="app-main-row min-h-0 flex-1 flex"')
  .replace('class="header-wrapper"', 'class="app-breadcrumb"');

describe.each([
  ["deployed 2026.1012.0, production shell", PRODUCTION],
  ["deployed 2026.1012.0, streamlined shell", STREAMLINED],
  ["upstream 8035f8b, production shell", upstream(PRODUCTION)],
  ["upstream 8035f8b, streamlined shell", upstream(STREAMLINED)],
])("selectors on %s markup", (_name, markup) => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("find exactly the shell, sidebar, top bar and mobile nav", () => {
    document.body.innerHTML = markup;
    const shells = document.querySelectorAll(SHELL_SELECTOR);
    expect(shells).toHaveLength(1);
    expect(shells[0].firstElementChild?.getAttribute("href")).toBe("#main-content");
    const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
    expect(sidebars).toHaveLength(1);
    expect(sidebars[0].classList.contains("plugin-app-shell-overlays")).toBe(false);
    expect(document.querySelectorAll(`${SIDEBAR_SELECTOR} nav a[aria-current="page"]`)).toHaveLength(1);
    const headers = document.querySelectorAll(HEADER_SELECTOR);
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toBe("Dashboard");
    expect(document.querySelectorAll(MOBILE_NAV_SELECTOR)).toHaveLength(1);
    expect(document.querySelectorAll(`${MOBILE_NAV_SELECTOR} a[aria-current="page"]`)).toHaveLength(1);
  });
});
