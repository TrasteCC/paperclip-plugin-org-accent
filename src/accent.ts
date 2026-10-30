// Host selectors and theme tokens come from paperclipai/paperclip ui/src (see README).

export const STYLE_ELEMENT_ID = "paperclip-org-accent-style";
export const ROOT_ATTRIBUTE = "data-org-accent";

// The app shell root is the only element whose direct child is the skip link.
// 2026.1012.0 gives it no stable class (later upstream adds .paperclip-app-shell),
// so match it structurally to cover both.
export const SHELL_SELECTOR = 'div:has(> a[href="#main-content"])';
export const SIDEBAR_SELECTOR = `${SHELL_SELECTOR} aside:has(> nav)`;
// The breadcrumb wrapper: first child of the content column, directly followed by
// the row that holds <main>. The sidebar column also precedes <main>'s column, so
// exclude anything that contains an <aside>.
export const HEADER_SELECTOR = `${SHELL_SELECTOR} div:first-child:not(:has(aside)):has(+ div main#main-content)`;
export const MOBILE_NAV_SELECTOR = 'nav[aria-label="Mobile navigation"]';

/** Fixed tints for the top bar and mobile nav backgrounds (not user-tunable). */
const HEADER_TINT = 10;
const MOBILE_NAV_TINT = 12;

export const PRESETS = {
  amber: { label: "Amber", accentColor: "#ba7517", textColor: "#ffffff" },
  green: { label: "Green", accentColor: "#3b6d11", textColor: "#ffffff" },
  sky: { label: "Sky", accentColor: "#00aaff", textColor: "#04263a" },
  blue: { label: "Blue", accentColor: "#185fa5", textColor: "#ffffff" },
  violet: { label: "Violet", accentColor: "#534ab7", textColor: "#ffffff" },
  teal: { label: "Teal", accentColor: "#0f6e56", textColor: "#ffffff" },
  coral: { label: "Coral", accentColor: "#d85a30", textColor: "#ffffff" },
  slate: { label: "Slate", accentColor: "#5f5e5a", textColor: "#ffffff" },
} as const;

export type PresetName = keyof typeof PRESETS;
export type AccentMode = "default" | "custom";

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === "string" && Object.hasOwn(PRESETS, value);
}

/** Resolved per-company settings, as stored. Custom fields are kept in Default mode too. */
export type AccentSettings = {
  mode: AccentMode;
  preset: PresetName | null;
  accentColor: string | null;
  textColor: string | null;
  backgroundTint: number;
  navTint: number;
  // Stored key kept from v0.2 (it drew a band then); now accents the top bar.
  showBand: boolean;
  showSidebarEdge: boolean;
  showMobileNav: boolean;
};

/** Anything read from storage or the UI; every field is untrusted and optional. */
export type RawAccentSettings = Partial<Record<keyof AccentSettings, unknown>> | null | undefined;

/** What actually gets painted. */
export type Appearance = Omit<AccentSettings, "mode" | "preset">;

export const DEFAULTS = {
  backgroundTint: 5,
  navTint: 22,
  showBand: true,
  showSidebarEdge: true,
  showMobileNav: true,
} as const;

export const RANGES = {
  backgroundTint: { min: 0, max: 20 },
  navTint: { min: 0, max: 40 },
} as const;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts only #rgb / #rrggbb so stored values can never inject CSS. */
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Integer in [min, max]; anything non-numeric falls back to the default. */
export function clampPercent(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Records without `mode` (v0.1/v0.2) load as Custom. */
export function resolveConfig(raw: RawAccentSettings): AccentSettings {
  const preset = isPresetName(raw?.preset) ? raw.preset : null;
  return {
    mode: raw?.mode === "default" && preset ? "default" : "custom",
    preset,
    accentColor: normalizeColor(raw?.accentColor),
    textColor: normalizeColor(raw?.textColor),
    backgroundTint: clampPercent(raw?.backgroundTint, RANGES.backgroundTint, DEFAULTS.backgroundTint),
    navTint: clampPercent(raw?.navTint, RANGES.navTint, DEFAULTS.navTint),
    showBand: bool(raw?.showBand, DEFAULTS.showBand),
    showSidebarEdge: bool(raw?.showSidebarEdge, DEFAULTS.showSidebarEdge),
    showMobileNav: bool(raw?.showMobileNav, DEFAULTS.showMobileNav),
  };
}

/** Default mode: the preset's colors with every tunable at its default. */
export function effectiveAppearance(settings: AccentSettings): Appearance {
  if (settings.mode === "default" && settings.preset) {
    const preset = PRESETS[settings.preset];
    return { accentColor: preset.accentColor, textColor: preset.textColor, ...DEFAULTS };
  }
  const { mode: _mode, preset: _preset, ...custom } = settings;
  return custom;
}

/** White or near-black, whichever reads better on the accent. */
export function readableTextColor(accent: string): string {
  const hex = accent.length === 4
    ? accent.slice(1).split("").map((c) => c + c).join("")
    : accent.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.3 ? "#111111" : "#ffffff";
}

/** Expects an appearance with a valid accent color. Nothing here changes layout. */
export function buildAccentCss(appearance: Appearance): string {
  const accent = appearance.accentColor ?? "";
  const text = appearance.textColor ?? readableTextColor(accent);
  const shell = SHELL_SELECTOR;
  const sidebar = SIDEBAR_SELECTOR;
  const rules = [`
${shell} {
  --org-accent: ${accent};
  --org-accent-text: ${text};
}`];
  if (appearance.backgroundTint > 0) {
    rules.push(`
${shell} {
  --background: color-mix(in srgb, var(--org-accent) ${appearance.backgroundTint}%, oklch(1 0 0));
}
.dark ${shell} {
  --background: color-mix(in srgb, var(--org-accent) ${appearance.backgroundTint}%, oklch(0.205 0 0));
}`);
  }
  if (appearance.showBand) {
    rules.push(`
${HEADER_SELECTOR} {
  background-color: color-mix(in srgb, var(--org-accent) ${HEADER_TINT}%, var(--background));
}`);
  }
  // The top accent line runs across the sidebar only, not over the page header.
  const sidebarLines = [
    appearance.showBand ? "inset 0 3px 0 var(--org-accent)" : null,
    appearance.showSidebarEdge ? "inset -3px 0 0 var(--org-accent)" : null,
  ].filter(Boolean);
  if (sidebarLines.length > 0) {
    rules.push(`
${sidebar} {
  box-shadow: ${sidebarLines.join(", ")};
}`);
  }
  if (appearance.navTint > 0) {
    rules.push(`
${sidebar} nav a.bg-accent,
${sidebar} nav a.bg-sidebar-accent,
${sidebar} nav a[aria-current="page"] {
  background-color: color-mix(in srgb, var(--org-accent) ${appearance.navTint}%, transparent);
}`);
  }
  if (appearance.showMobileNav) {
    rules.push(`
${MOBILE_NAV_SELECTOR} {
  background-color: color-mix(in srgb, var(--org-accent) ${MOBILE_NAV_TINT}%, var(--muted));
  box-shadow: inset 0 3px 0 var(--org-accent);
}
${MOBILE_NAV_SELECTOR} a[aria-current="page"] {
  color: var(--org-accent);
}`);
  }
  return `${rules.join("\n")}\n`;
}

/** Applies (or replaces) the accent. Settings without an effective accent color remove it. */
export function applyAccent(raw: RawAccentSettings, doc: Document = document): void {
  const appearance = effectiveAppearance(resolveConfig(raw));
  if (!appearance.accentColor) {
    removeAccent(doc);
    return;
  }
  let style = doc.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    doc.head.appendChild(style);
  }
  style.textContent = buildAccentCss(appearance);
  doc.documentElement.setAttribute(ROOT_ATTRIBUTE, appearance.accentColor);
}

export function removeAccent(doc: Document = document): void {
  doc.getElementById(STYLE_ELEMENT_ID)?.remove();
  doc.documentElement.removeAttribute(ROOT_ATTRIBUTE);
}

/**
 * Live preview for the settings page: `update` paints a draft, `commit` makes it
 * the new saved state, `revert` repaints the last saved state (Cancel / leaving).
 */
export function createPreview(saved: RawAccentSettings, doc: Document = document) {
  let current = saved;
  return {
    update(draft: RawAccentSettings) {
      applyAccent(draft, doc);
    },
    commit(next: RawAccentSettings) {
      current = next;
      applyAccent(next, doc);
    },
    revert() {
      applyAccent(current, doc);
    },
  };
}
