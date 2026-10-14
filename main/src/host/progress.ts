/** Process-local UI observations; ended means driver idle, not task acceptance. */
import { STAGES, type Stage, type StageStatus, type TaskProgress } from '../shared';
export function createProgress(full = true): TaskProgress {
  const now = new Date().toISOString();
  return { current: 'triage', updatedAt: now, steps: STAGES.map(id => ({ id, status: id === 'input' ? 'done' : id === 'triage' ? 'active' : 'pending', ...(id === 'input' ? { startedAt: now, finishedAt: now } : id === 'triage' ? { startedAt: now } : {}), ...(['triage', 'compare', 'verify', 'assemble'].includes(id) ? { note: full ? '等待查看、评估与理解提交；执行建议可调整，但不能静默跳过本环节。' : '轻量查看与简短理解仍需提交；短输入不跳过本环节。' } : {}) })) };
}
/** Set only observed stages; unsubmitted judgments stay pending until supplied. */
export function mark(progress: TaskProgress, id: Stage, status: StageStatus, note?: string): void {
  const step = progress.steps.find(step => step.id === id)!;
  const now = new Date().toISOString();
  if (status === 'active') {
    for (const previous of progress.steps) if (previous.id !== id && previous.status === 'active') {
      // A stage left without a submission is unknown, never silently completed.
      previous.status = previous.id === 'execute' ? 'ended' : 'pending';
      if (previous.status === 'ended') previous.finishedAt = now;
    }
  }
  step.status = status;
  if (note !== undefined) step.note = note;
  else if (!['failed', 'degraded', 'paused'].includes(status)) delete step.note;
  if (status === 'pending') { delete step.startedAt; delete step.finishedAt; }
  if (status !== 'pending') step.startedAt ??= now;
  if (status === 'done' || status === 'ended' || status === 'assessed') step.finishedAt = now;
  else delete step.finishedAt;
  if (status !== 'done' && status !== 'pending') progress.current = id;
  progress.updatedAt = now;
}
