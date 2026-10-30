import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { DEFAULTS } from "../src/accent.js";
import manifest from "../src/manifest.js";
import plugin, { type AccentData } from "../src/worker.js";

const COMPANY = "company-1";
const scope = { scopeKind: "company" as const, scopeId: COMPANY, stateKey: "accent" };
const EMPTY = { mode: "custom", preset: null, accentColor: null, textColor: null, ...DEFAULTS };

async function setup() {
  const harness = createTestHarness({ manifest });
  await plugin.definition.setup(harness.ctx);
  return harness;
}

const asUser = { actor: { type: "user" as const, userId: "user-1" }, companyId: COMPANY };

describe("org-accent worker", () => {
  it("declares the capabilities its slots need", () => {
    expect(manifest.version).toBe("0.3.0");
    expect(manifest.capabilities).toContain("ui.action.register");
    expect(manifest.capabilities).toContain("instance.settings.register");
    expect(manifest.ui?.slots?.map((s) => s.type)).toEqual(["appShellOverlay", "companySettingsPage"]);
  });

  it("returns no accent and default settings before anything is saved", async () => {
    const harness = await setup();
    expect(await harness.getData<AccentData>("accent", { companyId: COMPANY })).toEqual(EMPTY);
  });

  it("saves and loads custom settings per company", async () => {
    const harness = await setup();
    const input = {
      mode: "custom",
      preset: null,
      accentColor: "#C05621",
      textColor: "#FFFFFF",
      backgroundTint: 9,
      navTint: 30,
      showBand: false,
      showSidebarEdge: false,
      showMobileNav: false,
    };
    await harness.performAction("save-accent", input, asUser);
    const expected = { ...input, accentColor: "#c05621", textColor: "#ffffff" };
    expect(harness.getState(scope)).toEqual(expected);
    expect(await harness.getData<AccentData>("accent", { companyId: COMPANY })).toEqual(expected);
    expect((await harness.getData<AccentData>("accent", { companyId: "company-2" })).accentColor).toBeNull();
  });

  it("saves a preset by name in default mode", async () => {
    const harness = await setup();
    await harness.performAction("save-accent", { mode: "default", preset: "sky" }, asUser);
    expect(harness.getState(scope)).toEqual({ ...EMPTY, mode: "default", preset: "sky" });
  });

  it("rejects unknown presets and modes", async () => {
    const harness = await setup();
    await expect(harness.performAction("save-accent", { mode: "default", preset: "hotpink" }, asUser)).rejects.toThrow(/preset/);
    await expect(harness.performAction("save-accent", { mode: "default" }, asUser)).rejects.toThrow(/preset/);
    await expect(
      harness.performAction("save-accent", { mode: "custom", preset: "__proto__", accentColor: "#C05621" }, asUser),
    ).rejects.toThrow(/preset/);
    await expect(harness.performAction("save-accent", { mode: "fancy", accentColor: "#C05621" }, asUser)).rejects.toThrow(/mode/);
  });

  it("clamps numbers and ignores junk before storing", async () => {
    const harness = await setup();
    await harness.performAction(
      "save-accent",
      { accentColor: "#C05621", backgroundTint: 80, navTint: "12.4", showBand: "yes", injected: "x" },
      asUser,
    );
    expect(harness.getState(scope)).toEqual({
      ...EMPTY,
      accentColor: "#c05621",
      backgroundTint: 20,
      navTint: 12,
    });
  });

  it("reads v0.1/v0.2 records (no mode) as Custom with defaults", async () => {
    const harness = await setup();
    await harness.ctx.state.set(scope, { accentColor: "#2F855A", textColor: "#FFFFFF", backgroundTint: 7, showBand: false });
    expect(await harness.getData<AccentData>("accent", { companyId: COMPANY })).toEqual({
      ...EMPTY,
      accentColor: "#2f855a",
      textColor: "#ffffff",
      backgroundTint: 7,
      showBand: false,
    });
  });

  it("clears the record when saved without an accent", async () => {
    const harness = await setup();
    await harness.performAction("save-accent", { mode: "default", preset: "green" }, asUser);
    await harness.performAction("save-accent", { mode: "custom", preset: null, accentColor: "", textColor: "" }, asUser);
    expect(harness.getState(scope)).toBeUndefined();
  });

  it("rejects invalid colors and agent callers", async () => {
    const harness = await setup();
    await expect(harness.performAction("save-accent", { accentColor: "red" }, asUser)).rejects.toThrow(/hex/);
    await expect(
      harness.performAction("save-accent", { accentColor: "#3182CE" }, { actor: { type: "agent", agentId: "agent-1" }, companyId: COMPANY }),
    ).rejects.toThrow(/board users/);
  });
});
