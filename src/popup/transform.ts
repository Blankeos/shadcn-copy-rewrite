import type { ReplacementRule } from "../shared/config";

export function applyRules(text: string, rules: ReplacementRule[]): string {
  let out = text;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.from) continue;
    out = out.split(rule.from).join(rule.to ?? "");
  }

  return out;
}

