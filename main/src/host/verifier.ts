/** Adapter for registered DSH verifier tools; never reads or writes its private settings. */
import type { JudgeAttempt, VerifierSettings } from '../shared';
export const DEFAULT_VERIFIER_SETTINGS: VerifierSettings = { planningRoute: 'auto', repeats: 1 };
export function parseVerifierSettings(value: unknown): VerifierSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected verifier route settings');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !['planningRoute', 'repeats'].includes(key)) || !['auto', 'compare', 'select', 'track'].includes(String(row.planningRoute)) || !Number.isInteger(row.repeats) || Number(row.repeats) < 1 || Number(row.repeats) > 2) throw new Error('Invalid route or repeats (1–2); model configuration belongs to DSH LLM Verifier');
  return { planningRoute: row.planningRoute as VerifierSettings['planningRoute'], repeats: Number(row.repeats) };
}
export function planningRequest(settings: VerifierSettings, args: Record<string, unknown>, problem: string, triage: string, comparison: string) {
  const strings = (value: unknown, name: string): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 8 || value.some(s => typeof s !== 'string' || !s.trim() || s.length > 100000)) throw new Error(`Invalid ${name}`);
    return value as string[];
  };
  const candidates = strings(args.candidates, 'candidates'), steps = strings(args.steps, 'steps');
  const route = settings.planningRoute === 'auto' ? candidates && candidates.length >= 3 ? 'select' : steps ? 'track' : 'compare' : settings.planningRoute;
  if (route === 'select') {
    if (!candidates || candidates.length < 3) throw new Error('select needs at least three real model-authored candidate plans; never fabricate candidates');
    return { tool: 'verifier_select', reason: '三个或以上真实规划候选排序（proposal）', arguments: { problem, candidates, review_stage: 'proposal', repeats: settings.repeats, pivots: 1 } };
  }
  if (route === 'track') {
    const checkpoints = args.checkpoints;
    if (!steps || steps.length < 2 || !Array.isArray(checkpoints) || !checkpoints.length || checkpoints.some(i => !Number.isInteger(i) || Number(i) < 1 || Number(i) > steps.length)) throw new Error('track needs real steps and valid one-based checkpoint indexes');
    return { tool: 'verifier_track', reason: '已有过程步骤的检查点评价；进度评分不代表规划或交付通过', arguments: { problem, steps, checkpoints, repeats: settings.repeats } };
  }
  if (candidates && candidates.length !== 2) throw new Error('compare needs exactly two real candidate plans');
  return { tool: 'verifier_compare', reason: candidates ? '两个真实规划候选对照（proposal）' : '主模型分诊/层对照策略与直接实施基线对照（兼容路径）；需在装配时补足具体计划', arguments: { problem, candidate_a: candidates?.[0] ?? JSON.stringify({ triage, comparison, plan: 'Execute the original task using this orchestration; report gaps and evidence.' }), candidate_b: candidates?.[1] ?? 'Execute the original user request directly using available tools without the proposed layer comparison or delegation plan.', review_stage: 'proposal', repeats: settings.repeats } };
}
export function recordEvaluation(attempt: JudgeAttempt, value: unknown): void {
  attempt.evaluation = value;
  if (!value || typeof value !== 'object') return;
  const row = value as Record<string, unknown>;
  if (typeof row.provider === 'string') attempt.provider = row.provider;
  if (typeof row.model === 'string') attempt.model = row.model;
}
