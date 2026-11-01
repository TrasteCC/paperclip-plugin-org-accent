// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_ELEMENT_ID, removeAccent, resolveConfig, type RawAccentSettings } from "../src/accent.js";

const state: { data: RawAccentSettings } = { data: null };
const save = vi.fn(async (params: Record<string, unknown>) => resolveConfig(params));

vi.mock("@paperclipai/plugin-sdk/ui", () => ({
  usePluginData: () => ({ data: resolveConfig(state.data), loading: false, error: null, refresh: () => {} }),
  usePluginAction: () => save,
}));

const { AccentSettingsPage } = await import("../src/ui/index.js");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const context = { companyId: "company-1", companyPrefix: "ACM", projectId: null, entityId: null, entityType: null, userId: "user-1" };
let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<AccentSettingsPage context={context} />));
}
const q = (selector: string) => container.querySelectorAll(selector);
const css = () => document.getElementById(STYLE_ELEMENT_ID)?.textContent ?? "";
const button = (label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;
const radio = (mode: string) => q(`[role="radio"][data-mode="${mode}"]`)[0] as HTMLButtonElement;
function click(el: Element) {
  act(() => (el as HTMLElement).click());
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  save.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  removeAccent();
});

describe("settings page", () => {
  it("default mode shows only the 8 swatches, no sliders or toggles", () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    expect(q('[role="radiogroup"] [role="radio"]')).toHaveLength(2);
    expect(radio("default").getAttribute("aria-checked")).toBe("true");
    expect(radio("custom").getAttribute("aria-checked")).toBe("false");
    expect(q("button[data-preset]")).toHaveLength(8);
    expect(q('button[data-preset="amber"]')[0].getAttribute("aria-pressed")).toBe("true");
    expect(q('button[data-preset="amber"]')[0].getAttribute("aria-label")).toBe("Amber");
    expect(container.textContent).toContain("Amber");
    expect(q('input[type="range"]')).toHaveLength(0);
    expect(q('[role="switch"]')).toHaveLength(0);
    expect(q('input[type="color"]')).toHaveLength(0);
  });

  it("a company with nothing saved opens on Default colors, with Save disabled until a swatch is picked", () => {
    state.data = null;
    render();
    expect(radio("default").getAttribute("aria-checked")).toBe("true");
    expect(q("button[data-preset]")).toHaveLength(8);
    expect(q('button[aria-pressed="true"]')).toHaveLength(0);
    expect(button("Save").disabled).toBe(true);
    click(q('button[data-preset="blue"]')[0]);
    expect(button("Save").disabled).toBe(false);
    expect(css()).toContain("--org-accent: #185fa5");
  });

  it("records without mode open in Custom with every control", () => {
    state.data = { accentColor: "#C05621", textColor: "#FFFFFF" };
    render();
    expect(radio("custom").getAttribute("aria-checked")).toBe("true");
    expect(q("button[data-preset]")).toHaveLength(0);
    expect(q('input[type="range"]')).toHaveLength(4);
    expect(q('input[type="color"]')).toHaveLength(2);
    expect(Array.from(q('[role="switch"]')).map((s) => s.getAttribute("aria-label"))).toEqual([
      "Top bar",
      "Sidebar edge",
      "Mobile bottom navigation",
    ]);
    expect(Array.from(q('[role="switch"]')).every((s) => s.getAttribute("aria-checked") === "true")).toBe(true);
    expect((q('input[aria-label="Text on accent"]')[0] as HTMLInputElement).placeholder).toBe("automatic");
  });

  it("previews a clicked swatch, saves it by name, and keeps it after leaving", async () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    click(q('button[data-preset="violet"]')[0]);
    expect(css()).toContain("--org-accent: #534ab7");
    await act(async () => button("Save").click());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ mode: "default", preset: "violet", companyId: "company-1" }));
    act(() => root.unmount());
    expect(css()).toContain("--org-accent: #534ab7");
    root = createRoot(container);
  });

  it("reverts the preview when leaving without saving", () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    click(q('button[data-preset="teal"]')[0]);
    expect(css()).toContain("--org-accent: #0f6e56");
    act(() => root.unmount());
    expect(css()).toContain("--org-accent: #ba7517");
    root = createRoot(container);
  });

  it("switching to Custom starts from the preset colors", () => {
    state.data = { mode: "default", preset: "coral" };
    render();
    click(radio("custom"));
    const text = q('input[type="text"]')[0] as HTMLInputElement;
    expect(text.value).toBe("#d85a30");
    expect(q('input[type="range"]')).toHaveLength(4);
  });

  it("arrow keys move between the two modes", () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    act(() => {
      radio("default").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(radio("custom").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("custom"));
    act(() => {
      radio("custom").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    });
    expect(radio("default").getAttribute("aria-checked")).toBe("true");
  });

  it("switches toggle their accent and hide the intensity slider when off", () => {
    state.data = { accentColor: "#C05621" };
    render();
    const topBar = q('[role="switch"][aria-label="Top bar"]')[0] as HTMLButtonElement;
    click(topBar);
    expect(topBar.getAttribute("aria-checked")).toBe("false");
    expect(q('input[type="range"]')).toHaveLength(3);
    expect(css()).not.toContain("var(--org-accent) 10%, var(--background)");
    click(topBar);
    expect(q('input[type="range"]')).toHaveLength(4);
    expect(css()).toContain("var(--org-accent) 10%, var(--background)");
  });

  it("Cancel reverts the draft and the preview, and Save reports the result", async () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    expect(button("Cancel").disabled).toBe(true);
    click(q('button[data-preset="slate"]')[0]);
    expect(button("Cancel").disabled).toBe(false);
    click(button("Cancel"));
    expect(css()).toContain("--org-accent: #ba7517");
    expect(q('button[data-preset="amber"]')[0].getAttribute("aria-pressed")).toBe("true");
    click(q('button[data-preset="slate"]')[0]);
    await act(async () => button("Save").click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe("✓ Saved");
  });

  it("keeps styles scoped to the plugin root", () => {
    state.data = { mode: "default", preset: "amber" };
    render();
    const rules = container.querySelector("style")?.textContent ?? "";
    const selectors = rules.split("}").map((r) => r.split("{")[0].trim()).filter(Boolean);
    expect(selectors.length).toBeGreaterThan(10);
    for (const selector of selectors) {
      for (const part of selector.split(",")) expect(part.trim().startsWith(".oa-settings")).toBe(true);
    }
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

