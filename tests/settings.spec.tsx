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
    expect(q('input[type="radio"]')).toHaveLength(2);
    expect((q('input[value="default"]')[0] as HTMLInputElement).checked).toBe(true);
    expect(q("button[data-preset]")).toHaveLength(8);
    expect(q('button[data-preset="amber"]')[0].getAttribute("aria-pressed")).toBe("true");
    expect(q('input[type="range"]')).toHaveLength(0);
    expect(q('input[type="checkbox"]')).toHaveLength(0);
    expect(q('input[type="color"]')).toHaveLength(0);
  });

  it("a company with nothing saved opens on Default colors, with Save disabled until a swatch is picked", () => {
    state.data = null;
    render();
    expect((q('input[value="default"]')[0] as HTMLInputElement).checked).toBe(true);
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
    expect((q('input[value="custom"]')[0] as HTMLInputElement).checked).toBe(true);
    expect(q("button[data-preset]")).toHaveLength(0);
    expect(q('input[type="range"]')).toHaveLength(2);
    expect(q('input[type="checkbox"]')).toHaveLength(3);
    expect(container.textContent).toContain("Accent the top bar");
    expect(container.textContent).toContain("Accent the mobile bottom navigation");
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
    click(q('input[value="custom"]')[0]);
    const text = q('input[type="text"]')[0] as HTMLInputElement;
    expect(text.value).toBe("#d85a30");
    expect(q('input[type="range"]')).toHaveLength(2);
  });
});
