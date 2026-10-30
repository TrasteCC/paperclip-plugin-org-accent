import { describe, expect, it } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import type { Company } from "@paperclipai/shared";
import { DEFAULTS } from "../src/accent.js";
import manifest from "../src/manifest.js";
import plugin, { type AccentData } from "../src/worker.js";

const COMPANY = "company-1";
const scope = { scopeKind: "company" as const, scopeId: COMPANY, stateKey: "accent" };

async function setup() {
  const harness = createTestHarness({ manifest });
  harness.seed({ companies: [{ id: COMPANY, name: "Acme Corp", issuePrefix: "ACM" } as Company] });
  await plugin.definition.setup(harness.ctx);
  return harness;
}

const asUser = { actor: { type: "user" as const, userId: "user-1" }, companyId: COMPANY };

describe("org-accent worker", () => {
  it("declares the capabilities its slots need", () => {
    expect(manifest.capabilities).toContain("ui.action.register");
    expect(manifest.capabilities).toContain("instance.settings.register");
    expect(manifest.ui?.slots?.map((s) => s.type)).toEqual(["appShellOverlay", "companySettingsPage"]);
  });

  it("returns no accent and default settings before anything is saved", async () => {
    const harness = await setup();
    const data = await harness.getData<AccentData>("accent", { companyId: COMPANY });
    expect(data).toEqual({ accentColor: null, textColor: null, ...DEFAULTS, companyName: "Acme Corp" });
  });

  it("saves and loads every setting per company", async () => {
    const harness = await setup();
    await harness.performAction(
      "save-accent",
      { accentColor: "#C05621", textColor: "#FFFFFF", backgroundTint: 9, navTint: 30, showBand: false, showSidebarEdge: false },
      asUser,
    );
    const expected = { accentColor: "#c05621", textColor: "#ffffff", backgroundTint: 9, navTint: 30, showBand: false, showSidebarEdge: false };
    expect(harness.getState(scope)).toEqual(expected);
    const data = await harness.getData<AccentData>("accent", { companyId: COMPANY });
    expect(data).toEqual({ ...expected, companyName: "Acme Corp" });
    const other = await harness.getData<AccentData>("accent", { companyId: "company-2" });
    expect(other.accentColor).toBeNull();
  });

  it("clamps numbers and ignores junk before storing", async () => {
    const harness = await setup();
    await harness.performAction(
      "save-accent",
      { accentColor: "#C05621", backgroundTint: 80, navTint: "12.4", showBand: "yes", injected: "x" },
      asUser,
    );
    expect(harness.getState(scope)).toEqual({
      accentColor: "#c05621",
      textColor: null,
      backgroundTint: 20,
      navTint: 12,
      showBand: true,
      showSidebarEdge: true,
    });
  });

  it("reads old records that only have the two colors", async () => {
    const harness = await setup();
    await harness.ctx.state.set(scope, { accentColor: "#2F855A", textColor: "#FFFFFF" });
    const data = await harness.getData<AccentData>("accent", { companyId: COMPANY });
    expect(data).toEqual({ accentColor: "#2f855a", textColor: "#ffffff", ...DEFAULTS, companyName: "Acme Corp" });
  });

  it("clears the record when saved without an accent", async () => {
    const harness = await setup();
    await harness.performAction("save-accent", { accentColor: "#2F855A", textColor: "" }, asUser);
    await harness.performAction("save-accent", { accentColor: "", textColor: "" }, asUser);
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
