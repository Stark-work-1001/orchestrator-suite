/** Compact session header status, independent of all other plugins. */
import React, { useEffect, useRef, useState } from 'react';
import { PROGRESS_ROUTE, VERSION, STAGES, PHASES, PHASE_STAGES, phaseOf, assessmentChecklist, type TaskRecord } from '../shared';
import { TaskStages } from './stages';
type Task = Omit<TaskRecord, 'catalog'> & { readMemoryIds: string[] };
interface Snapshot { version?: string; ok: true; sessionId: string; preset: string; pollMs: number; task: Task | null }
export interface ProgressProps { sessionId: string; t: (key: string) => string }
export function isResponse(value: unknown, sessionId: string): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const body = value as Snapshot;
  return body.ok === true && (body.version === undefined || typeof body.version === 'string') && body.sessionId === sessionId && typeof body.preset === 'string' && Number.isSafeInteger(body.pollMs) && body.pollMs >= 500 && body.pollMs <= 30000 && (body.task === null || (!!body.task && body.task.sessionId === sessionId && typeof body.task.prompt === 'string' && STAGES.includes(body.task.progress?.current) && Array.isArray(body.task.progress?.steps) && new Set(body.task.progress.steps.map(s => s.id)).size === STAGES.length && body.task.progress.steps.length === STAGES.length && body.task.progress.steps.every(s => STAGES.includes(s.id) && ['pending', 'active', 'done', 'assessed', 'failed', 'paused', 'ended', 'degraded', 'skipped'].includes(s.status))));
}
export function ProgressStatus({ sessionId, t }: ProgressProps): React.ReactNode {
  const [data, setData] = useState<Snapshot | null>(null), [error, setError] = useState(''), [opened, setOpened] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setData(null); setError(''); setOpened(false);
    if (!sessionId) return;
    let disposed = false, busy = false, delay = 1500, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    async function poll() {
      if (disposed || busy || document.hidden) return;
      busy = true; controller = new AbortController();
      try {
        const response = await fetch(PROGRESS_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const body: unknown = await response.json();
        if (!response.ok || !isResponse(body, sessionId)) throw new Error(t('progress.fetchFailed'));
        if (!disposed && !controller.signal.aborted) { delay = body.pollMs; setData(body); setError(''); }
      } catch (reason) { if (!disposed && !controller.signal.aborted) setError(String(reason)); }
      finally { busy = false; if (!disposed && !document.hidden) timer = setTimeout(() => void poll(), delay); }
    }
    const visibility = () => { clearTimeout(timer); if (document.hidden) controller?.abort(); else void poll(); };
    document.addEventListener('visibilitychange', visibility); void poll();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [sessionId, t]);
  useEffect(() => {
    if (!opened) return;
    const click = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpened(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpened(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); };
  }, [opened]);
  const task = data?.sessionId === sessionId ? data.task : null, progress = task?.progress;
  const status = progress?.steps.find(s => s.id === progress.current)?.status ?? 'pending';
  const gaps = progress?.steps.filter(s => s.status === 'degraded' || s.status === 'failed').length ?? 0;
  const assessments = task ? assessmentChecklist(task) : [];
  const evidenceCount = assessments.filter(a => a.assessed).length;
  const label = error ? t('progress.staleShort') : progress ? `${t(`workflow.phase.${phaseOf(progress.current)}`)} · ${t(`stage.${progress.current}`)} · ${t(`progress.status.${status}`)}` : t('progress.title');
  return <div className="os-status os-themed" ref={root}>
    <button ref={trigger} className="os-status-trigger" aria-label={label} title={label} aria-expanded={opened} aria-haspopup="dialog" onClick={() => setOpened(value => !value)}>
      <span className={`os-status-light os-status-${error ? 'degraded' : status}`} aria-hidden="true" /><span>{label}</span>
      {progress && <span className="os-status-position" title={t('progress.stagePosition')} aria-label={t('progress.stagePosition')}>{PHASES.indexOf(phaseOf(progress.current)) + 1}/{PHASES.length}</span>}
      <span className="os-status-dots" aria-hidden="true">{progress && PHASES.map(phase => <i key={phase} className={`os-status-${phase === phaseOf(progress.current) ? status : PHASE_STAGES[phase].every(id => assessments.some(a => a.stage === id && a.assessed)) ? 'done' : 'pending'}`} />)}</span>{gaps > 0 && <span className="os-status-gap" title={t('progress.gaps')}>! {gaps}</span>}
    </button>
    {opened && <section className="os-status-popover" role="dialog" aria-label={t('progress.title')}>
      <header><strong>{t('progress.title')}</strong><button aria-label={t('progress.close')} onClick={() => { setOpened(false); trigger.current?.focus(); }}>×</button></header>
      {error && <div className="os-warning" role="alert">{error}<p>{t('progress.stale')}</p></div>}
      {!task ? <p>{t('progress.noTask')}</p> : <>
        <p className="os-runtime-version">{t('workflow.runtimeVersion')} {data?.version ?? t('workflow.runtimeUnknown')}{data?.version !== VERSION && <strong> · {t('workflow.runtimeMismatch')}</strong>}</p>
        <p className="os-caption">{data?.preset} · {t('turn')} {task.turn} · {t('progress.evidenceCount')} {evidenceCount}/{STAGES.length}</p>
        <div className="os-status-summary" role="status"><strong>{t(`stage.${progress!.current}`)}</strong><span>{t(`progress.status.${status}`)}</span>{gaps > 0 && <p>{t('progress.gaps')} · {gaps} · {t('progress.canContinue')}</p>}</div>
        <TaskStages key={task.taskId ?? `${task.sessionId}:${task.prompt}`} task={task} t={t} />
        <p className="os-caption">{t('progress.evidenceHint')}</p><details className="os-status-info"><summary>{t('progress.readingGuide')}</summary><p className="os-caption">{t('judgeBody')}</p></details>{progress?.updatedAt && <p className="os-caption">{t('progress.autoRefresh')} · <time dateTime={progress.updatedAt}>{new Date(progress.updatedAt).toLocaleTimeString()}</time></p>}
      </>}
    </section>}
  </div>;
}
