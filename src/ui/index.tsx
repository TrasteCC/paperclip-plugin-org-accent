import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePluginAction,
  usePluginData,
  type PluginCompanySettingsPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import {
  RANGES,
  applyAccent,
  createPreview,
  normalizeColor,
  readableTextColor,
  removeAccent,
  resolveConfig,
  type ResolvedAccentConfig,
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
    if (data) applyAccent(data, data.companyName);
  }, [data]);

  useEffect(() => () => removeAccent(), []);

  return null;
}

type Draft = Omit<ResolvedAccentConfig, "accentColor" | "textColor"> & { accentColor: string; textColor: string };

function toDraft(config: ResolvedAccentConfig): Draft {
  return { ...config, accentColor: config.accentColor ?? "", textColor: config.textColor ?? "" };
}

const fieldStyle = { display: "grid", gap: "6px", maxWidth: "360px" } as const;
const rowStyle = { display: "flex", gap: "8px", alignItems: "center" } as const;
const errorStyle = { color: "var(--destructive)" } as const;

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
    const initial = toDraft(resolveConfig(data));
    preview.current = createPreview(data, data.companyName);
    setSaved(initial);
    setDraft(initial);
  }, [data]);

  // Leaving the page without saving repaints the saved values.
  useEffect(() => () => preview.current?.revert(), []);

  const accentValid = draft ? draft.accentColor === "" || normalizeColor(draft.accentColor) !== null : true;
  const textValid = draft ? draft.textColor === "" || normalizeColor(draft.textColor) !== null : true;

  useEffect(() => {
    if (draft && accentValid && textValid) preview.current?.update(draft);
  }, [draft, accentValid, textValid]);

  if (error) return <div>Could not load the accent settings: {error.message}</div>;
  if (loading && !draft) return <div>Loading…</div>;
  if (!draft || !saved) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const previewAccent = normalizeColor(draft.accentColor);
  const previewText = normalizeColor(draft.textColor) ?? (previewAccent ? readableTextColor(previewAccent) : null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  async function persist(next: Draft) {
    setStatus("Saving…");
    try {
      const stored = resolveConfig((await save({ companyId: context.companyId, ...next })) as Partial<Draft>);
      preview.current?.commit(stored);
      setSaved(toDraft(stored));
      setDraft(toDraft(stored));
      refresh();
      setStatus(stored.accentColor ? "Saved." : "Tint removed.");
    } catch (err) {
      setStatus(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Accent color</h2>
        <p style={{ margin: "4px 0 0", opacity: 0.7 }}>
          Tints this company's top band, sidebar and background. Changes preview live; leave the accent empty for no tint.
        </p>
      </div>

      <label style={fieldStyle}>
        <span>Accent color</span>
        <span style={rowStyle}>
          <input type="color" value={previewAccent ?? "#000000"} onChange={(e) => set("accentColor", e.target.value)} />
          <input type="text" value={draft.accentColor} placeholder="#3366cc" onChange={(e) => set("accentColor", e.target.value)} />
        </span>
        {!accentValid && <span style={errorStyle}>Use a hex color like #3366cc.</span>}
      </label>

      <label style={fieldStyle}>
        <span>Text color on the band</span>
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
        <span>Show the top band with the company name</span>
      </label>

      <label style={rowStyle}>
        <input type="checkbox" checked={draft.showSidebarEdge} onChange={(e) => set("showSidebarEdge", e.target.checked)} />
        <span>Show the colored sidebar edge</span>
      </label>

      <div style={rowStyle}>
        <button
          type="button"
          disabled={!dirty || !accentValid || !textValid}
          onClick={() => void persist(draft)}
        >
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
        <button type="button" onClick={() => void persist({ ...draft, accentColor: "", textColor: "" })}>
          Remove tint
        </button>
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
