// Host selectors and theme tokens come from paperclipai/paperclip ui/src (see README).

export const STYLE_ELEMENT_ID = "paperclip-org-accent-style";
export const ROOT_ATTRIBUTE = "data-org-accent";

// The app shell root is the only element whose direct child is the skip link.
// 2026.1012.0 gives it no stable class (later upstream adds .paperclip-app-shell),
// so match it structurally to cover both.
export const SHELL_SELECTOR = 'div:has(> a[href="#main-content"])';
export const SIDEBAR_SELECTOR = `${SHELL_SELECTOR} aside:has(> nav)`;

/** Stored per company. Every field but the colors is optional so old records keep working. */
export type AccentConfig = {
  accentColor: string | null;
  textColor: string | null;
  backgroundTint?: number;
  navTint?: number;
  showBand?: boolean;
  showSidebarEdge?: boolean;
};

export type ResolvedAccentConfig = Required<AccentConfig>;

export const DEFAULTS = {
  backgroundTint: 5,
  navTint: 22,
  showBand: true,
  showSidebarEdge: true,
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

export function resolveConfig(raw: Partial<Record<keyof AccentConfig, unknown>> | null | undefined): ResolvedAccentConfig {
  return {
    accentColor: normalizeColor(raw?.accentColor),
    textColor: normalizeColor(raw?.textColor),
    backgroundTint: clampPercent(raw?.backgroundTint, RANGES.backgroundTint, DEFAULTS.backgroundTint),
    navTint: clampPercent(raw?.navTint, RANGES.navTint, DEFAULTS.navTint),
    showBand: typeof raw?.showBand === "boolean" ? raw.showBand : DEFAULTS.showBand,
    showSidebarEdge: typeof raw?.showSidebarEdge === "boolean" ? raw.showSidebarEdge : DEFAULTS.showSidebarEdge,
  };
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

function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

/** Expects a resolved config with a valid accent color. */
export function buildAccentCss(config: ResolvedAccentConfig, label: string | null): string {
  const accent = config.accentColor ?? "";
  const text = config.textColor ?? readableTextColor(accent);
  const shell = SHELL_SELECTOR;
  const sidebar = SIDEBAR_SELECTOR;
  const rules = [`
${shell} {
  --org-accent: ${accent};
  --org-accent-text: ${text};
}`];
  if (config.backgroundTint > 0) {
    rules.push(`
${shell} {
  --background: color-mix(in srgb, var(--org-accent) ${config.backgroundTint}%, oklch(1 0 0));
}
.dark ${shell} {
  --background: color-mix(in srgb, var(--org-accent) ${config.backgroundTint}%, oklch(0.205 0 0));
}`);
  }
  if (config.showBand) {
    rules.push(`
${shell}::before {
  content: ${cssString(label ?? "")};
  display: flex;
  flex: none;
  align-items: center;
  height: 34px;
  padding-inline: 16px;
  background: var(--org-accent);
  color: var(--org-accent-text);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`);
  }
  if (config.showSidebarEdge) {
    rules.push(`
${sidebar} {
  border-right: 3px solid var(--org-accent);
}`);
  }
  if (config.navTint > 0) {
    rules.push(`
${sidebar} nav a.bg-accent,
${sidebar} nav a.bg-sidebar-accent,
${sidebar} nav a[aria-current="page"] {
  background-color: color-mix(in srgb, var(--org-accent) ${config.navTint}%, transparent);
}`);
  }
  return `${rules.join("\n")}\n`;
}

/** Applies (or replaces) the accent. A config without an accent color removes it. */
export function applyAccent(
  raw: Partial<Record<keyof AccentConfig, unknown>> | null,
  label: string | null,
  doc: Document = document,
): void {
  const config = resolveConfig(raw);
  if (!config.accentColor) {
    removeAccent(doc);
    return;
  }
  let style = doc.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    doc.head.appendChild(style);
  }
  style.textContent = buildAccentCss(config, label);
  doc.documentElement.setAttribute(ROOT_ATTRIBUTE, config.accentColor);
}

export function removeAccent(doc: Document = document): void {
  doc.getElementById(STYLE_ELEMENT_ID)?.remove();
  doc.documentElement.removeAttribute(ROOT_ATTRIBUTE);
}

/**
 * Live preview for the settings page: `update` paints a draft, `commit` makes it
 * the new saved state, `revert` repaints the last saved state (Cancel / leaving).
 */
export function createPreview(saved: AccentConfig | null, label: string | null, doc: Document = document) {
  let current = saved;
  return {
    update(draft: AccentConfig) {
      applyAccent(draft, label, doc);
    },
    commit(next: AccentConfig) {
      current = next;
      applyAccent(next, label, doc);
    },
    revert() {
      applyAccent(current, label, doc);
    },
  };
}
