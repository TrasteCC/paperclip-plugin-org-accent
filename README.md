# Org Accent — a Paperclip plugin

Tints the whole [Paperclip](https://github.com/paperclipai/paperclip) UI in a
per-company accent color, so you always know which company you are working in
(like a per-workspace color in an editor).

For the selected company it can add:

- a **top bar accent**: a 3px accent line along the top of the page header
  (breadcrumb bar) and a light tint of its background,
- a 3px accent **sidebar edge** on the primary sidebar,
- a **selected nav item tint** (the active sidebar link mixed with the accent),
- a **background tint** (the page surface mixed with the accent, in light and dark mode),
- a **mobile bottom navigation accent** on narrow screens: a 3px accent top
  edge, a light background tint and the active item in the accent color.

None of these change the size or position of anything on the page: lines are
inset shadows and tints are background colors. A company with no accent color
set gets no tint at all.

## Settings

Each company has its own settings page under **Company Settings → Accent color**
(route `/<company-prefix>/company/settings/accent-color`). At the top, board
users choose a color mode.

### Default colors

One click on one of eight swatches. Every slider and toggle is hidden; the
company gets the defaults below (background tint 5 %, selected item 22 %, every
accent on).

| Preset | Accent | Text on accent |
|---|---|---|
| Amber | `#BA7517` | `#FFFFFF` |
| Green | `#3B6D11` | `#FFFFFF` |
| Sky | `#00AAFF` | `#04263A` |
| Blue | `#185FA5` | `#FFFFFF` |
| Violet | `#534AB7` | `#FFFFFF` |
| Teal | `#0F6E56` | `#FFFFFF` |
| Coral | `#D85A30` | `#FFFFFF` |
| Slate | `#5F5E5A` | `#FFFFFF` |

The preset is stored **by name**, so retuning a preset's colors in a later
version updates every company that uses it.

### Custom colors

| Setting | Values | Default |
|---|---|---|
| Accent color | hex `#rgb` / `#rrggbb`; empty = no tint | empty |
| Text color on the accent | hex; empty = automatic white or near-black, whichever contrasts better | automatic |
| Background tint | 0–20 % (integer); 0 leaves the host background untouched | 5 |
| Selected nav item tint | 0–40 % (integer); 0 leaves the host highlight untouched | 22 |
| Accent the top bar | on / off | on |
| Sidebar edge | on / off | on |
| Accent the mobile bottom navigation | on / off | on |

Switching from Default to Custom starts from the chosen preset's colors.

### Saving and preview

Changes **preview live** on the page while you edit. **Save** stores them;
**Cancel**, or leaving the page without saving, repaints the saved values.
**Remove tint** clears the company's record.

All settings live in one record per company, stored with the plugin state API
(`ctx.state`, `scopeKind: "company"`, `stateKey: "accent"`):

```json
{
  "mode": "default",
  "preset": "blue",
  "accentColor": null,
  "textColor": null,
  "backgroundTint": 5,
  "navTint": 22,
  "showBand": true,
  "showSidebarEdge": true,
  "showMobileNav": true
}
```

Custom values are kept in Default mode, so switching back restores them.
`showBand` keeps its v0.2 name for compatibility; it now controls the top bar
accent. Records written by older versions keep working: a record without
`mode` loads as Custom, and missing fields take the defaults above.

Both the settings page and the worker validate input: `mode` must be
`default` or `custom`, `preset` must be one of the eight names, colors must be
hex, percentages are rounded to integers and clamped to their range, and
toggles must be booleans, so a stored value can never inject CSS. Agents cannot
change the settings.

Settings can also be written without the UI, through the worker action
`save-accent` with `companyId` plus the fields above, for example
`{ "companyId": "<company-id>", "mode": "default", "preset": "teal" }`.

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
`plugin.state.write`. (v0.2 also asked for `companies.read` to print the
company name in a band; v0.3 no longer needs it.)

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
also match upstream `8035f8b245fddeda5857a2248688eaac7c6051e6`, where the
shell gains `.paperclip-app-shell` / `.app-main-row` / `.app-breadcrumb`
classes. Tests cover both versions with both app shells (the default
`Layout.production.tsx` and the streamlined `Layout.tsx`).

| Selector / variable | What it does | Upstream source |
|---|---|---|
| `div:has(> a[href="#main-content"])` (shell) | the app shell root, the only element whose direct child is the "Skip to Main Content" link; holds `--org-accent`, `--org-accent-text` and the tinted `--background` | `ui/src/components/Layout.production.tsx`, `ui/src/components/Layout.tsx` |
| `--background` (light base `oklch(1 0 0)`) | page surface, mixed with the background tint | `ui/src/index.css` `:root` |
| `.dark` shell → `--background` (dark base `oklch(0.205 0 0)`) | dark-mode surface, mixed with the background tint | `ui/src/index.css` `.dark` (class on `<html>`, `ui/src/context/ThemeContext.tsx`) |
| shell ` div:first-child:not(:has(aside)):has(+ div main#main-content)` (top bar) | the breadcrumb wrapper: first child of the content column, directly followed by the row that holds `<main>`; the sidebar column is excluded because it contains an `<aside>`. Gets `box-shadow: inset 0 3px 0` accent and a 10 % accent background | `ui/src/components/Layout.production.tsx`, `ui/src/components/Layout.tsx` (wrapper around `BreadcrumbBar`, `ui/src/components/BreadcrumbBar*.tsx`) |
| shell ` aside:has(> nav)` | primary sidebar `<aside>`: `box-shadow: inset -3px 0 0` accent (the plugin overlay `<aside>` has no `<nav>`, so it is not matched) | `ui/src/components/Sidebar.production.tsx`, `ui/src/components/Sidebar.tsx` |
| `… nav a.bg-accent`, `… nav a.bg-sidebar-accent`, `… nav a[aria-current="page"]` | selected nav item (production class / streamlined class / NavLink ARIA), mixed with the nav tint | `ui/src/components/SidebarNavItem.production.tsx`, `ui/src/components/SidebarNavItem.tsx` |
| `nav[aria-label="Mobile navigation"]` | mobile bottom navigation (shown below the `md` breakpoint): `box-shadow: inset 0 3px 0` accent and a 12 % accent mix into `--muted` | `ui/src/components/MobileBottomNav.tsx` |
| `nav[aria-label="Mobile navigation"] a[aria-current="page"]` | active mobile nav item, text and icon in the accent color | same |

The styles are unlayered, so they win over Tailwind v4's `@layer utilities`
classes without `!important`. Popovers and dialogs render outside the shell and
keep the stock theme on purpose.

## Known limits

- The light/dark base surface colors are copied from upstream `index.css`. If
  upstream changes `--background`, update the two literals in `src/accent.ts`.
- With the streamlined UI enabled, the primary sidebar uses its own surface
  class instead of `bg-background`, so its background may not pick up the tint
  (the sidebar edge and the selected item still do). On the streamlined
  task-detail view the breadcrumb moves next to `<main>` and the top bar
  accent does not apply there.
- The mobile nav's "New Task" entry is a button, not a link, so it never shows
  the active accent.
- Only the selected company is tinted. The company switcher, popovers and
  dialogs are not colored.

## License

MIT
