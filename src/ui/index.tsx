import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePluginAction,
  usePluginData,
  type PluginCompanySettingsPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  PRESETS,
  RANGES,
  applyAccent,
  createPreview,
  normalizeColor,
  readableTextColor,
  removeAccent,
  resolveConfig,
  type AccentMode,
  type AccentSettings,
  type PresetName,
} from "../accent.js";
import type { AccentData } from "../worker.js";

function useAccentData(companyId: string | null) {
  const params = useMemo(() => ({ companyId }), [companyId]);
  return usePluginData<AccentData>("accent", params);
}

/** Invisible: only paints the host shell. The host remounts it per company. */
export function AccentOverlay({ context }: PluginWidgetProps) {
  const { data } = useAccentData(context.companyId);

  useEffect(() => {
    if (data) applyAccent(data);
  }, [data]);

  useEffect(() => () => removeAccent(), []);

  return null;
}

type Draft = Omit<AccentSettings, "accentColor" | "textColor"> & { accentColor: string; textColor: string };

function toDraft(settings: AccentSettings): Draft {
  return { ...settings, accentColor: settings.accentColor ?? "", textColor: settings.textColor ?? "" };
}

/** A company with nothing saved opens on Default colors; saved records keep their mode. */
export function initialDraft(settings: AccentSettings): Draft {
  const draft = toDraft(settings);
  return settings.accentColor || settings.preset ? draft : { ...draft, mode: "default" };
}

const fieldStyle = { display: "grid", gap: "6px", maxWidth: "360px" } as const;
const rowStyle = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } as const;
const errorStyle = { color: "var(--destructive)" } as const;

function swatchStyle(color: string, selected: boolean) {
  return {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: color,
    border: "none",
    cursor: "pointer",
    outline: selected ? "2px solid var(--foreground)" : "none",
    outlineOffset: "2px",
  } as const;
}

export function AccentSettingsPage({ context }: PluginCompanySettingsPageProps) {
  const { data, loading, error, refresh } = useAccentData(context.companyId);
  const save = usePluginAction("save-accent");
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const preview = useRef<ReturnType<typeof createPreview> | null>(null);

  // First load only: later refreshes must not clobber an in-progress edit.
  useEffect(() => {
    if (!data || preview.current) return;
    const initial = initialDraft(resolveConfig(data));
    preview.current = createPreview(data);
    setSaved(initial);
    setDraft(initial);
  }, [data]);

  // Leaving the page without saving repaints the saved values.
  useEffect(() => () => preview.current?.revert(), []);

  const custom = draft?.mode === "custom";
  const accentValid = !custom || !draft || draft.accentColor === "" || normalizeColor(draft.accentColor) !== null;
  const textValid = !custom || !draft || draft.textColor === "" || normalizeColor(draft.textColor) !== null;

  useEffect(() => {
    if (draft && accentValid && textValid) preview.current?.update(draft);
  }, [draft, accentValid, textValid]);

  if (error) return <div>Could not load the accent settings: {error.message}</div>;
  if (loading && !draft) return <div>Loading…</div>;
  if (!draft || !saved) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const canSave = dirty && accentValid && textValid && (draft.mode === "custom" || draft.preset !== null);
  const previewAccent = normalizeColor(draft.accentColor);
  const previewText = normalizeColor(draft.textColor) ?? (previewAccent ? readableTextColor(previewAccent) : null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  function switchMode(mode: AccentMode) {
    if (!draft) return;
    const next = { ...draft, mode };
    // Start Custom from the chosen preset's colors when no custom color exists yet.
    if (mode === "custom" && !draft.accentColor && draft.preset) {
      next.accentColor = PRESETS[draft.preset].accentColor;
      next.textColor = PRESETS[draft.preset].textColor;
    }
    setDraft(next);
  }

  async function persist(next: Draft) {
    setStatus("Saving…");
    try {
      const stored = resolveConfig((await save({ companyId: context.companyId, ...next })) as Partial<Draft>);
      preview.current?.commit(stored);
      setSaved(toDraft(stored));
      setDraft(toDraft(stored));
      refresh();
      setStatus(stored.mode === "default" || stored.accentColor ? "Saved." : "Tint removed.");
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Accent color</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.7 }}>
          Tints this company's top bar, sidebar, background and mobile navigation. Changes preview live.
        </p>
      </div>

      <div role="radiogroup" aria-label="Color mode" style={rowStyle}>
        {(["default", "custom"] as const).map((mode) => (
          <label key={mode} style={rowStyle}>
            <input
              type="radio"
              name="org-accent-mode"
              value={mode}
              checked={draft.mode === mode}
              onChange={() => switchMode(mode)}
            />
            <span>{mode === "default" ? "Default colors" : "Custom colors"}</span>
          </label>
        ))}
      </div>

      {draft.mode === "default" ? (
        <div role="group" aria-label="Default colors" style={rowStyle}>
          {(Object.keys(PRESETS) as PresetName[]).map((name) => (
            <button
              key={name}
              type="button"
              title={PRESETS[name].label}
              aria-label={PRESETS[name].label}
              aria-pressed={draft.preset === name}
              data-preset={name}
              style={swatchStyle(PRESETS[name].accentColor, draft.preset === name)}
              onClick={() => set("preset", name)}
            />
          ))}
        </div>
      ) : (
        <>
          <label style={fieldStyle}>
            <span>Accent color</span>
            <span style={rowStyle}>
              <input type="color" value={previewAccent ?? "#000000"} onChange={(e) => set("accentColor", e.target.value)} />
              <input type="text" value={draft.accentColor} placeholder="#3366cc" onChange={(e) => set("accentColor", e.target.value)} />
            </span>
            {!accentValid && <span style={errorStyle}>Use a hex color like #3366cc.</span>}
          </label>

          <label style={fieldStyle}>
            <span>Text color on the accent</span>
            <span style={rowStyle}>
              <input type="color" value={previewText ?? "#ffffff"} onChange={(e) => set("textColor", e.target.value)} />
              <input type="text" value={draft.textColor} placeholder="automatic" onChange={(e) => set("textColor", e.target.value)} />
            </span>
            {!textValid && <span style={errorStyle}>Use a hex color like #ffffff, or leave empty for automatic.</span>}
          </label>

          <label style={fieldStyle}>
            <span>Background tint: {draft.backgroundTint}%</span>
            <input
              type="range"
              min={RANGES.backgroundTint.min}
              max={RANGES.backgroundTint.max}
              step={1}
              value={draft.backgroundTint}
              onChange={(e) => set("backgroundTint", Number(e.target.value))}
            />
          </label>

          <label style={fieldStyle}>
            <span>Selected nav item tint: {draft.navTint}%</span>
            <input
              type="range"
              min={RANGES.navTint.min}
              max={RANGES.navTint.max}
              step={1}
              value={draft.navTint}
              onChange={(e) => set("navTint", Number(e.target.value))}
            />
          </label>

          <label style={rowStyle}>
            <input type="checkbox" checked={draft.showBand} onChange={(e) => set("showBand", e.target.checked)} />
            <span>Accent the top bar</span>
          </label>

          <label style={rowStyle}>
            <input type="checkbox" checked={draft.showSidebarEdge} onChange={(e) => set("showSidebarEdge", e.target.checked)} />
            <span>Show the colored sidebar edge</span>
          </label>

          <label style={rowStyle}>
            <input type="checkbox" checked={draft.showMobileNav} onChange={(e) => set("showMobileNav", e.target.checked)} />
            <span>Accent the mobile bottom navigation</span>
          </label>
        </>
      )}

      <div style={rowStyle}>
        <button type="button" disabled={!canSave} onClick={() => void persist(draft)}>
          Save
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            setDraft(saved);
            preview.current?.revert();
            setStatus(null);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void persist({ ...draft, mode: "custom", preset: null, accentColor: "", textColor: "" })}
        >
          Remove tint
        </button>
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
