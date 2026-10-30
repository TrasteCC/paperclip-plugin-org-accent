import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "traste.org-accent",
  apiVersion: 1,
  version: "0.3.2",
  displayName: "Org Accent",
  description: "Tints the whole UI in a per-company accent color so organizations are easy to tell apart.",
  author: "traste",
  categories: ["ui"],
  capabilities: [
    "ui.action.register",
    "instance.settings.register",
    "plugin.state.read",
    "plugin.state.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "appShellOverlay",
        id: "org-accent-overlay",
        displayName: "Org Accent",
        exportName: "AccentOverlay",
      },
      {
        type: "companySettingsPage",
        id: "org-accent-settings",
        displayName: "Accent color",
        exportName: "AccentSettingsPage",
        routePath: "accent-color",
      },
      {
        // Same page under Plugins → Org Accent, for the selected company.
        type: "settingsPage",
        id: "org-accent-plugin-settings",
        displayName: "Accent color",
        exportName: "AccentSettingsPage",
      },
    ],
  },
};

export default manifest;
