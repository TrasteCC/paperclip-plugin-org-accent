import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import {
  effectiveAppearance,
  isPresetName,
  normalizeColor,
  resolveConfig,
  type AccentSettings,
  type RawAccentSettings,
} from "./accent.js";

const STATE_KEY = "accent";

export type AccentData = AccentSettings;

function requireCompanyId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("companyId is required");
  return value;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register("accent", async (params): Promise<AccentData> => {
      const companyId = requireCompanyId(params.companyId);
      const stored = (await ctx.state.get({ scopeKind: "company", scopeId: companyId, stateKey: STATE_KEY })) as RawAccentSettings;
      return resolveConfig(stored);
    });

    ctx.actions.register("save-accent", async (params, { actor }) => {
      if (actor.type === "agent") throw new Error("Only board users can change the accent color");
      const companyId = requireCompanyId(actor.companyId ?? params.companyId);
      const scope = { scopeKind: "company" as const, scopeId: companyId, stateKey: STATE_KEY };
      if (params.mode !== undefined && params.mode !== "default" && params.mode !== "custom") {
        throw new Error('mode must be "default" or "custom"');
      }
      if (params.mode === "default" && !isPresetName(params.preset)) throw new Error("preset is not one of the default colors");
      if (params.preset != null && params.preset !== "" && !isPresetName(params.preset)) {
        throw new Error("preset is not one of the default colors");
      }
      if (params.accentColor && !normalizeColor(params.accentColor)) throw new Error("accentColor must be a #rrggbb hex color");
      if (params.textColor && !normalizeColor(params.textColor)) throw new Error("textColor must be a #rrggbb hex color");
      const saved = resolveConfig(params);
      if (!effectiveAppearance(saved).accentColor) {
        await ctx.state.delete(scope);
        return resolveConfig(null);
      }
      await ctx.state.set(scope, saved);
      return saved;
    });
  },

  async onHealth() {
    return { status: "ok", message: "Org accent worker is running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
