import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

// Scoped styles: every selector starts with .oa-settings so nothing leaks into
// Paperclip. Only host semantic tokens are used, so light and dark both work.
const STYLES = `
.oa-settings { display: grid; gap: 20px; max-width: 560px; color: var(--foreground); font-size: 14px; }
.oa-settings * { box-sizing: border-box; }
.oa-settings .oa-title { margin: 0; font-size: 16px; font-weight: 600; }
.oa-settings .oa-desc { margin: 4px 0 0; color: var(--muted-foreground); font-size: 13px; }
.oa-settings .oa-muted { color: var(--muted-foreground); font-size: 12px; }
.oa-settings .oa-mono { font-family: var(--font-mono, ui-monospace, monospace); }
.oa-settings button { font: inherit; cursor: pointer; }
.oa-settings button:disabled { opacity: 0.5; cursor: not-allowed; }
.oa-settings button:focus-visible, .oa-settings input:focus-visible {
  outline: 2px solid var(--ring); outline-offset: 2px;
}
.oa-settings .oa-segment { justify-self: start; display: inline-flex; gap: 2px; padding: 3px; border-radius: 9999px; background: var(--muted); }
.oa-settings .oa-segment button {
  border: 0; border-radius: 9999px; padding: 6px 14px; background: transparent;
  color: var(--muted-foreground); font-size: 13px; font-weight: 500;
}
.oa-settings .oa-segment button[aria-checked="true"] {
  background: var(--background); color: var(--foreground);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 15%, transparent);
}
.oa-settings .oa-swatches { display: flex; flex-wrap: wrap; gap: 12px; }
.oa-settings .oa-swatch {
  width: 30px; height: 30px; border-radius: 9999px; border: 0; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700;
}
.oa-settings .oa-swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--oa-swatch); }
.oa-settings .oa-card {
  display: grid; gap: 14px; padding: 16px; border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 1.4);
  background: color-mix(in srgb, var(--muted) 35%, var(--background));
}
.oa-settings .oa-card-title { margin: 0; font-size: 12px; font-weight: 500; color: var(--muted-foreground); }
.oa-settings .oa-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; }
.oa-settings .oa-row-end { display: flex; align-items: center; gap: 8px; }
.oa-settings .oa-chip {
  position: relative; width: 26px; height: 26px; border-radius: 9999px; overflow: hidden;
  border: 1px solid var(--border); flex: none;
}
.oa-settings .oa-chip input { position: absolute; inset: -8px; width: 42px; height: 42px; border: 0; padding: 0; cursor: pointer; }
.oa-settings .oa-hex {
  width: 112px; padding: 5px 12px; border-radius: 9999px; border: 1px solid var(--border);
  background: var(--background); color: var(--foreground); font-size: 13px;
}
.oa-settings .oa-hex::placeholder { color: var(--muted-foreground); }
.oa-settings .oa-hex[aria-invalid="true"] { border-color: var(--destructive); }
.oa-settings .oa-error { color: var(--destructive); font-size: 12px; }
.oa-settings .oa-slider { display: grid; gap: 6px; }
.oa-settings .oa-slider input[type="range"] {
  -webkit-appearance: none; appearance: none; width: 100%; height: 16px; margin: 0; background: transparent; cursor: pointer;
  --oa-track: linear-gradient(to right, var(--org-accent, var(--primary)) var(--oa-fill), color-mix(in srgb, var(--foreground) 18%, transparent) var(--oa-fill));
}
.oa-settings .oa-slider input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 9999px; background: var(--oa-track); }
.oa-settings .oa-slider input[type="range"]::-moz-range-track { height: 4px; border-radius: 9999px; background: var(--oa-track); }
.oa-settings .oa-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -6px; border: 0; border-radius: 9999px;
  background: var(--background); box-shadow: 0 0 0 3px var(--org-accent, var(--primary));
}
.oa-settings .oa-slider input[type="range"]::-moz-range-thumb {
  width: 16px; height: 16px; border: 0; border-radius: 9999px;
  background: var(--background); box-shadow: 0 0 0 3px var(--org-accent, var(--primary));
}
.oa-settings .oa-pill {
  min-width: 46px; padding: 2px 8px; border-radius: 9999px; background: var(--muted);
  color: var(--muted-foreground); font-size: 12px; text-align: center;
}
.oa-settings .oa-switch {
  position: relative; width: 34px; height: 20px; flex: none; border: 0; padding: 0;
  border-radius: 9999px; background: var(--muted);
}
.oa-settings .oa-switch[aria-checked="true"] { background: var(--org-accent, var(--primary)); }
.oa-settings .oa-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 9999px;
  background: var(--background); box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 25%, transparent);
  transition: transform 120ms ease;
}
.oa-settings .oa-switch[aria-checked="true"]::after { transform: translateX(14px); }
.oa-settings .oa-sub { padding-left: 4px; }
.oa-settings .oa-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.oa-settings .oa-text-danger { border: 0; background: transparent; padding: 6px 0; color: var(--destructive); }
.oa-settings .oa-btn {
  border-radius: 9999px; padding: 7px 16px; font-size: 13px; font-weight: 500;
  border: 1px solid var(--border); background: transparent; color: var(--foreground);
}
.oa-settings .oa-btn-primary { border-color: var(--primary); background: var(--primary); color: var(--primary-foreground); }
.oa-settings .oa-status { color: var(--muted-foreground); font-size: 13px; }
.oa-settings .oa-status[data-tone="error"] { color: var(--destructive); }
`;

const MODES = [
  { mode: "default", label: "Default colors" },
  { mode: "custom", label: "Custom colors" },
] as const;

function ModeSwitch({ mode, onChange }: { mode: AccentMode; onChange: (mode: AccentMode) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = MODES.findIndex((m) => m.mode === mode);
    const next = (index + step + MODES.length) % MODES.length;
    onChange(MODES[next].mode);
    refs.current[next]?.focus();
  }
  return (
    <div role="radiogroup" aria-label="Color mode" className="oa-segment" onKeyDown={onKeyDown}>
      {MODES.map((option, i) => (
        <button
          key={option.mode}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          tabIndex={mode === option.mode ? 0 : -1}
          data-mode={option.mode}
          onClick={() => onChange(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="oa-row">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="oa-switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

function Slider(props: { label: string; value: number; range: { min: number; max: number }; onChange: (value: number) => void; sub?: boolean }) {
  return (
    <label className={props.sub ? "oa-slider oa-sub" : "oa-slider"}>
      <span className="oa-row">
        <span className={props.sub ? "oa-muted" : undefined}>{props.label}</span>
        <span className="oa-pill oa-mono">{props.value}%</span>
      </span>
      <input
        type="range"
        min={props.range.min}
        max={props.range.max}
        step={1}
        value={props.value}
        style={{ "--oa-fill": `${((props.value - props.range.min) / (props.range.max - props.range.min)) * 100}%` } as React.CSSProperties}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorField(props: {
  label: string;
  value: string;
  chip: string;
  placeholder?: string;
  valid: boolean;
  error: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div className="oa-row">
        <span>{props.label}</span>
        <span className="oa-row-end">
          <span className="oa-chip" style={{ background: props.chip }}>
            <input type="color" aria-label={`${props.label} picker`} value={props.chip} onChange={(e) => props.onChange(e.target.value)} />
          </span>
          <input
            type="text"
            className="oa-hex oa-mono"
            aria-label={props.label}
            aria-invalid={!props.valid}
            value={props.value}
            placeholder={props.placeholder}
            onChange={(e) => props.onChange(e.target.value)}
          />
        </span>
      </div>
      {!props.valid && <span className="oa-error">{props.error}</span>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="oa-card">
      <h3 className="oa-card-title">{title}</h3>
      {children}
    </section>
  );
}

type Status = { tone: "info" | "ok" | "error"; text: string } | null;

export function AccentSettingsPage({ context }: PluginCompanySettingsPageProps) {
  const { data, loading, error, refresh } = useAccentData(context.companyId);
  const save = usePluginAction("save-accent");
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<Status>(null);
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
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft({ ...draft, [key]: value });
    setStatus(null);
  };

  function switchMode(mode: AccentMode) {
    if (!draft || mode === draft.mode) return;
    const next = { ...draft, mode };
    // Start Custom from the chosen preset's colors when no custom color exists yet.
    if (mode === "custom" && !draft.accentColor && draft.preset) {
      next.accentColor = PRESETS[draft.preset].accentColor;
      next.textColor = PRESETS[draft.preset].textColor;
    }
    setDraft(next);
    setStatus(null);
  }

  async function persist(next: Draft) {
    setStatus({ tone: "info", text: "Saving…" });
    try {
      const stored = resolveConfig((await save({ companyId: context.companyId, ...next })) as Partial<Draft>);
      preview.current?.commit(stored);
      setSaved(toDraft(stored));
      setDraft(toDraft(stored));
      refresh();
      setStatus({ tone: "ok", text: stored.mode === "default" || stored.accentColor ? "✓ Saved" : "✓ Tint removed" });
    } catch (err) {
      setStatus({ tone: "error", text: `Save failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  const selectedPreset = draft.preset ? PRESETS[draft.preset] : null;

  return (
    <div className="oa-settings">
      <style>{STYLES}</style>

      <div>
        <h2 className="oa-title">Accent color</h2>
        <p className="oa-desc">
          Tints this company's top bar, sidebar, background and mobile navigation. Changes preview live.
        </p>
      </div>

      <ModeSwitch mode={draft.mode} onChange={switchMode} />

      {draft.mode === "default" ? (
        <div style={{ display: "grid", gap: "10px" }}>
          <div role="group" aria-label="Default colors" className="oa-swatches">
            {(Object.keys(PRESETS) as PresetName[]).map((name) => {
              const preset = PRESETS[name];
              const selected = draft.preset === name;
              return (
                <button
                  key={name}
                  type="button"
                  className="oa-swatch"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={selected}
                  data-preset={name}
                  style={{ background: preset.accentColor, color: preset.textColor, ["--oa-swatch" as string]: preset.accentColor }}
                  onClick={() => set("preset", name)}
                >
                  {selected ? <span aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
          <span className="oa-muted">{selectedPreset ? selectedPreset.label : "Pick a color"}</span>
        </div>
      ) : (
        <>
          <Card title="Colors">
            <ColorField
              label="Accent"
              value={draft.accentColor}
              chip={previewAccent ?? "#000000"}
              placeholder="#3366cc"
              valid={accentValid}
              error="Use a hex color like #3366cc."
              onChange={(v) => set("accentColor", v)}
            />
            <ColorField
              label="Text on accent"
              value={draft.textColor}
              chip={previewText ?? "#ffffff"}
              placeholder="automatic"
              valid={textValid}
              error="Use a hex color like #ffffff, or leave empty for automatic."
              onChange={(v) => set("textColor", v)}
            />
          </Card>

          <Card title="Tint">
            <Slider label="Background" value={draft.backgroundTint} range={RANGES.backgroundTint} onChange={(v) => set("backgroundTint", v)} />
            <Slider label="Selected item" value={draft.navTint} range={RANGES.navTint} onChange={(v) => set("navTint", v)} />
          </Card>

          <Card title="Where to show it">
            <Switch label="Top bar" checked={draft.showBand} onChange={(v) => set("showBand", v)} />
            {draft.showBand && (
              <Slider sub label="Intensity" value={draft.headerTint} range={RANGES.headerTint} onChange={(v) => set("headerTint", v)} />
            )}
            <Switch label="Sidebar edge" checked={draft.showSidebarEdge} onChange={(v) => set("showSidebarEdge", v)} />
            <Switch label="Mobile bottom navigation" checked={draft.showMobileNav} onChange={(v) => set("showMobileNav", v)} />
            {draft.showMobileNav && (
              <Slider sub label="Intensity" value={draft.mobileNavTint} range={RANGES.mobileNavTint} onChange={(v) => set("mobileNavTint", v)} />
            )}
          </Card>
        </>
      )}

      <div className="oa-footer">
        <button
          type="button"
          className="oa-text-danger"
          onClick={() => void persist({ ...draft, mode: "custom", preset: null, accentColor: "", textColor: "" })}
        >
          Remove tint
        </button>
        <div className="oa-row-end">
          {status && (
            <span className="oa-status" data-tone={status.tone} role="status">
              {status.text}
            </span>
          )}
          <button
            type="button"
            className="oa-btn"
            disabled={!dirty}
            onClick={() => {
              setDraft(saved);
              preview.current?.revert();
              setStatus(null);
            }}
          >
            Cancel
          </button>
          <button type="button" className="oa-btn oa-btn-primary" disabled={!canSave} onClick={() => void persist(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
