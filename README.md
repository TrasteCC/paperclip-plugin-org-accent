# Org Accent — a Paperclip plugin

Tints the whole [Paperclip](https://github.com/paperclipai/paperclip) UI in a
per-company accent color, so you always know which company you are working in
(like a per-workspace color in an editor).

For the selected company it can draw:

- a solid 34px **top band** with the company name,
- a 3px accent **sidebar edge** on the primary sidebar,
- a **selected nav item tint** (the active sidebar link mixed with the accent),
- a **background tint** (the page surface mixed with the accent, in light and dark mode).

A company with no accent color set gets no tint at all.

## Settings

Each company has its own settings page under **Company Settings → Accent color**
(route `/<company-prefix>/company/settings/accent-color`). Board users can set:

| Setting | Values | Default |
|---|---|---|
| Accent color | hex `#rgb` / `#rrggbb`; empty = no tint | empty |
| Text color on the band | hex; empty = automatic white or near-black, whichever contrasts better | automatic |
| Background tint | 0–20 % (integer); 0 leaves the host background untouched | 5 |
| Selected nav item tint | 0–40 % (integer); 0 leaves the host highlight untouched | 22 |
| Top band | on / off | on |
| Sidebar edge | on / off | on |

Changes **preview live** on the page while you edit. **Save** stores them;
**Cancel**, or leaving the page without saving, repaints the saved values.
**Remove tint** clears the company's record.

All settings live in one record per company, stored with the plugin state API
(`ctx.state`, `scopeKind: "company"`, `stateKey: "accent"`). Records written by
older versions (accent and text color only) keep working; missing fields take
the defaults above. Both the settings page and the worker validate input:
colors must be hex, percentages are rounded to integers and clamped to their
range, and toggles must be booleans, so a stored value can never inject CSS.
Agents cannot change the settings.

Settings can also be written without the UI, through the worker action
`save-accent`:

```json
{
  "companyId": "<company-id>",
  "accentColor": "#3366cc",
  "textColor": "",
  "backgroundTint": 5,
  "navTint": 22,
  "showBand": true,
  "showSidebarEdge": true
}
```

## Build and test

Requires Node.js and pnpm. Uses the same toolchain as Paperclip's plugin
scaffold (`packages/plugins/create-paperclip-plugin`): esbuild with the SDK's
`createPluginBundlerPresets`, vitest and tsc. `@paperclipai/plugin-sdk` and
`@paperclipai/shared` are pinned to `2026.1012.0`; bump them to match the
Paperclip version you run.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Install

After `pnpm build`, the plugin package is this folder: `package.json` (its
`paperclipPlugin` block points at the built files) plus `dist/`:

- `dist/manifest.js`
- `dist/worker.js` (self-contained; the SDK is bundled in)
- `dist/ui/index.js` (React and the SDK UI module come from the host)

`node_modules/` is not needed at runtime. Copy `package.json` and `dist/` to
the Paperclip host and install from that folder:

```bash
paperclipai plugin install /path/to/paperclip-plugin-org-accent
```

Requires a Paperclip version with the `appShellOverlay` and
`companySettingsPage` slots (2026.1012.0 or later). Capabilities requested:
`ui.action.register`, `instance.settings.register`, `plugin.state.read`,
`plugin.state.write`, `companies.read` (to show the company name in the band).

## How it works

- **`appShellOverlay` slot** (`AccentOverlay`): the host mounts it once per
  selected company and disposes it when the company changes. It loads the
  company's settings and writes one `<style id="paperclip-org-accent-style">`
  into `<head>` plus a `data-org-accent` attribute on `<html>`. On unmount it
  removes both. It renders nothing visible.
- **`companySettingsPage` slot** (`AccentSettingsPage`, route `accent-color`):
  the settings form described above. Live preview repaints the same style
  element; revert repaints the last saved values.

## Host selectors and variables it overrides

The SDK has no theming API, so the plugin styles the host page directly.
Selectors were derived from Paperclip `2026.1012.0` (commit
`bba6a45f0d364cfd962ac59b3bdf2426a8222adb`). They are structural/ARIA so they
also match the later upstream commit `8035f8b245fddeda5857a2248688eaac7c6051e6`,
where the shell gains `.paperclip-app-shell` / `.app-main-row` classes; a test
covers both DOM shapes. Both app shells (the default `Layout.production.tsx`
and the streamlined `Layout.tsx`) share this structure.

| Selector / variable | What it does | Upstream source |
|---|---|---|
| `div:has(> a[href="#main-content"])` (shell) | the app shell root, the only element whose direct child is the "Skip to Main Content" link; holds `--org-accent`, `--org-accent-text` and the tinted `--background` | `ui/src/components/Layout.production.tsx`, `ui/src/components/Layout.tsx` |
| shell`::before` | the top band with the company name (first row of the flex-column shell) | same |
| `--background` (light base `oklch(1 0 0)`) | page surface, mixed with the background tint | `ui/src/index.css` `:root` |
| `.dark` shell → `--background` (dark base `oklch(0.205 0 0)`) | dark-mode surface, mixed with the background tint | `ui/src/index.css` `.dark` (class on `<html>`, `ui/src/context/ThemeContext.tsx`) |
| shell ` aside:has(> nav)` | primary sidebar `<aside>`: 3px accent `border-right` (the plugin overlay `<aside>` has no `<nav>`, so it is not matched) | `ui/src/components/Sidebar.production.tsx`, `ui/src/components/Sidebar.tsx` |
| `… nav a.bg-accent`, `… nav a.bg-sidebar-accent`, `… nav a[aria-current="page"]` | selected nav item (production class / streamlined class / NavLink ARIA), mixed with the nav tint | `ui/src/components/SidebarNavItem.production.tsx`, `ui/src/components/SidebarNavItem.tsx` |

The styles are unlayered, so they win over Tailwind v4's `@layer utilities`
classes without `!important`. Popovers and dialogs render outside the shell and
keep the stock theme on purpose.

## Known limits

- The light/dark base surface colors are copied from upstream `index.css`. If
  upstream changes `--background`, update the two literals in `src/accent.ts`.
- With the streamlined UI enabled, the primary sidebar uses its own surface
  class instead of `bg-background`, so its background may not pick up the tint
  (the sidebar edge and the selected item still do).
- Only the selected company is tinted. The company switcher, popovers and
  dialogs are not colored.

## License

MIT
