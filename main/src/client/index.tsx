/** Four-layer kanban mounted in two lifecycle-owned WebUI slots. */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ROUTE, type Asset, type Catalog, type TaskRecord } from '../shared';
import zh from '../../locale/zh.json';
import en from '../../locale/en.json';
import './board.css';
import { Surface } from './surface';
import { ProgressStatus } from './status';
import { TaskStages } from './stages';
import { VerifierPanel } from './verifier';
type Translate = (key: string) => string;
interface ClientContext {
  effect(fn: () => unknown, label?: string): unknown;
  locale: { register(name: string, dict: object): () => void; bind(name: string): Translate };
  slots: { inject(name: string, fn: () => unknown): unknown; register<P>(descriptor: object, render: (props: P) => React.ReactNode): () => void };
}
interface BoardResponse { ok: true; catalog: Catalog; tasks: Array<Omit<TaskRecord, 'catalog'>>; sessions: Array<{ id: string; preset: string }> }
let opened = false;
const subscribers = new Set<() => void>();
const setOpen = (value: boolean) => { opened = value; subscribers.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { subscribers.add(fn); return () => subscribers.delete(fn); };
const getOpen = () => opened;
export const name = 'orchestrator-suite';
export const inject = ['slots', 'locale'];
const tabs = ['overview', 'tools', 'memory', 'identity', 'organization', 'verification', 'dispatch'] as const;
type Tab = typeof tabs[number];
function Glyph({ kind = 'board' }: { kind?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'close' ? <path d="m6 6 12 12M6 18 18 6" /> : kind === 'refresh' ? <><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" /></> : <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16M15 4v16M5.5 8H7M11 8h2M17 8h2" /></>}</svg>;
}
function Assets({ rows, query, t }: { rows: Asset[]; query: string; t: Translate }) {
  const matches = (row: Asset): boolean => `${row.name} ${row.description} ${row.path ?? ''}`.toLowerCase().includes(query.toLowerCase()) || !!row.children?.some(matches);
  const selected = rows.filter(matches);
  return <div className="os-assets">{selected.length ? selected.map(row => <details className="os-asset" key={`${row.kind}:${row.id}`}>
    <summary><span className="os-asset-mark">{row.kind === 'skill' ? 'S' : row.kind === 'mcp' ? 'M' : row.kind === 'memory-file' ? 'R' : 'P'}</span><span className="os-asset-heading"><strong>{row.name}{!!row.children?.length && <small className="os-owned-count">{t('ownedAssets')} {row.children.length}</small>}</strong><span>{row.description || t('noDescription')}</span></span><span className={`os-badge os-${row.status}`}>{t(`status.${row.status}`)}</span></summary>
    <div className="os-asset-detail"><p>{row.description || t('noDescription')}</p>{row.path && <code>{row.path}</code>}{row.toolNames?.map(name => <code className="os-tool-name" key={name}>{name}</code>)}{row.evidence && <p className="os-evidence">{row.evidence}</p>}{(row.kind.startsWith('memory-') && row.kind !== 'memory-file' || row.protocol) && <dl className="os-connection"><dt>{t('protocol')}</dt><dd>{row.protocol ?? t('unknown')}</dd><dt>{t('port')}</dt><dd>{row.protocol === 'stdio' ? t('noTcpPort') : row.port ?? t('unknown')}</dd>{row.endpoint && <><dt>{t('endpoint')}</dt><dd><code>{row.endpoint}</code></dd></>}</dl>}{row.ownership && <p>{row.ownership}</p>}<p>{t('catalogHint')}</p>{!!row.children?.length && <Assets rows={row.children} query={query} t={t} />}</div>
  </details>) : <div className="os-empty">{t('empty')}</div>}</div>;
}
function Panel({ t }: { t: Translate }) {
  const [tab, setTab] = useState<Tab>('overview'), [toolTab, setToolTab] = useState<'skills' | 'plugins' | 'mcp' | 'environments'>('plugins');
  const [memoryTab, setMemoryTab] = useState('memory-system');
  const [options, setOptions] = useState<Pick<BoardResponse, 'sessions' | 'tasks'>>({ sessions: [], tasks: [] });
  const [data, setData] = useState<BoardResponse | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [attempt, setAttempt] = useState(0), [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState('');
  const changeScope = (value: string) => { setScope(value); setData(null); };
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshLater = () => { timer = setTimeout(() => { if (document.hidden) refreshLater(); else setAttempt(n => n + 1); }, 10000); };
    void fetch(ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(scope ? { sessionId: scope } : {}), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== 'object' || !('catalog' in value) || !('tasks' in value) || !('ok' in value) || value.ok !== true) throw new Error(t('fetchFailed'));
      const parsed = value as BoardResponse;
      if (!parsed.catalog || !['skills', 'plugins', 'mcp', 'memory', 'tools', 'warnings', 'memoryRoots'].every(key => Array.isArray(parsed.catalog[key as keyof Catalog])) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.sessions)) throw new Error(t('fetchFailed'));
      if (!controller.signal.aborted) { setData(parsed); setOptions({ sessions: parsed.sessions, tasks: parsed.tasks }); }
    }).catch(err => { if (!controller.signal.aborted) setError(String(err)); }).finally(() => { if (!controller.signal.aborted) { setLoading(false); refreshLater(); } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [attempt, t, scope]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; root.current?.focus();
    return () => previous?.focus();
  }, []);
  const changeTab = (next: Tab) => { setTab(next); setQuery(''); };
  const catalog = data?.catalog, task = data?.tasks.find(row => row.sessionId === scope);
  const standalone = (key: 'skills' | 'mcp' | 'environments') => (catalog?.[key] ?? []).filter(row => !row.ownerId || !catalog?.plugins.some(plugin => plugin.id === row.ownerId));
  const toolRows = toolTab === 'plugins' ? catalog?.plugins ?? [] : standalone(toolTab);
  const counts = catalog ? [catalog.skills.length + catalog.plugins.length + catalog.mcp.length + (catalog.environments?.length ?? 0), catalog.memory.length, catalog.identity?.length ?? 0, catalog.organization?.length ?? 0, catalog.verification?.length ?? 0] : [0, 0, 0, 0, 0];
  return <div className="os-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}><div ref={root} className="os-panel" role="dialog" aria-modal="true" aria-labelledby="os-title" tabIndex={-1} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    if (e.key === 'Tab') {
      const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,summary,[tabindex="0"]') ?? [])].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="os-header"><div className="os-logo"><Glyph /></div><div><div className="os-eyebrow">ORCHESTRATOR / 3.0.3</div><h1 id="os-title">{t('title')}</h1></div><span className="os-header-label">{t('readOnly')}</span><button className="os-icon" aria-label={t('refresh')} onClick={() => setAttempt(n => n + 1)} disabled={loading}><Glyph kind="refresh" /></button><button className="os-icon" aria-label={t('close')} onClick={() => setOpen(false)}><Glyph kind="close" /></button></header>
    <div className="os-layout"><nav className="os-nav" aria-label={t('layers')}>{tabs.map((id, index) => <button className={tab === id ? 'os-nav-active' : ''} key={id} onClick={() => changeTab(id)} aria-current={tab === id ? 'page' : undefined}><span className="os-nav-index">{String(index + 1).padStart(2, '0')}</span>{t(id)}{index > 0 && index < 6 && <span className="os-nav-count">{counts[index - 1]}</span>}</button>)}<div className="os-nav-note"><span className="os-dot" />{t('seam')}</div></nav>
    <main className="os-main"><div className="os-scope"><label htmlFor="os-scope">{t('scope')}</label><select id="os-scope" value={scope} onChange={e => changeScope(e.target.value)}><option value="">{t('hostScope')}</option>{options.sessions.map(row => <option key={row.id} value={row.id}>{row.id.slice(-8)} · {row.preset}</option>)}</select></div><div className="os-page-title"><div className="os-eyebrow">{t('workspace')}</div><h2>{t(tab)}</h2><p>{t(`${tab}.description`)}</p></div>
      {error && <div role="alert" className="os-warning">{error}<button onClick={() => setAttempt(n => n + 1)}>{t('retry')}</button></div>}
      {loading && !catalog && <p role="status" className="os-loading">{t('loading')}</p>}
      {catalog && <>
        {tab === 'overview' && <><div className="os-stats">{['tools', 'memory', 'identity', 'organization', 'verification'].map((id, i) => <button key={id} onClick={() => changeTab(id as Tab)}><span className="os-eyebrow">0{i + 1} / {t(id)}</span><strong>{counts[i]}</strong><span>{t(`${id}.metric`)}</span></button>)}</div><div className="os-grid"><article className="os-feature"><div className="os-eyebrow">RELIC</div><h3>{t('relicTitle')}</h3><p>{t('relicBody')}</p><div className="os-flow">{['discovery', 'reading', 'selection'].map(id => <span key={id}>{t(id)}</span>)}</div></article><article className="os-feature os-accent"><div className="os-eyebrow">DISPATCH-ORCHESTRATOR</div><h3>{t('dispatchTitle')}</h3><p>{t('dispatchBody')}</p><button className="os-link" onClick={() => changeTab('dispatch')}>{t('viewPipeline')} →</button></article></div><article className="os-note"><h3>{t('boundaries')}</h3><p>{t('boundaryBody')}</p></article></>}
        {(tab === 'tools' || tab === 'memory') && <><div className="os-toolbar">{tab === 'tools' ? <div className="os-pills">{(['plugins', 'skills', 'mcp', 'environments'] as const).map(id => <button key={id} className={id === toolTab ? 'selected' : ''} onClick={() => setToolTab(id)}>{t(id)} <span>{id === 'plugins' ? catalog.plugins.length : standalone(id).length}</span></button>)}</div> : <div className="os-pills">{['memory-system', 'memory-database', 'memory-file', 'memory-tool', 'observation'].map(kind => <button key={kind} className={memoryTab === kind ? 'selected' : ''} onClick={() => setMemoryTab(kind)}>{t(`kind.${kind}`)} <span>{catalog.memory.filter(row => row.kind === kind).length}</span></button>)}</div>}<input aria-label={t('search')} placeholder={t('search')} value={query} onChange={e => setQuery(e.target.value)} /></div>{tab === 'memory' && <><article className="os-note"><h3>{t('memoryProtocolTitle')}</h3><p>{t('memoryProtocolBody')}</p><code>relic_prepare → MCP / status / recall → relic_record_observation</code></article>{memoryTab === 'memory-file' && <div className="os-note"><span>{t('memoryRoots')}</span>{catalog.memoryRoots.map(path => <code key={path}>{path}</code>)}</div>}</>}{tab === 'tools' && toolTab !== 'plugins' && <p className="os-caption">{t('standaloneHint')}</p>}<Assets rows={tab === 'tools' ? toolRows : catalog.memory.filter(row => row.kind === memoryTab)} query={query} t={t} /></>}
        {tab === 'identity' && <><article className="os-feature"><div className="os-eyebrow">IDENTITY / RESPONSIBILITY</div><h3>{t('identityTitle')}</h3><p>{t('identityBody')}</p></article><h3>{t('identityResources')}</h3><Assets rows={catalog.identity ?? []} query="" t={t} /><div className="os-grid">{['lead', 'worker', 'reviewer'].map(id => <article className="os-note" key={id}><h3>{t(id)}</h3><p>{t(`${id}.description`)}</p></article>)}</div><p className="os-caption">{t('identityHint')}</p></>}
        {tab === 'organization' && <><article className="os-note"><h3>{t('triageConclusion')}</h3><p>{t('triageConclusionBody')}</p><pre className="os-report">{task?.triage || t('selectScopeForReport')}</pre></article><div className="os-grid">{['L0', 'L1', 'L2'].map(id => <article className="os-feature" key={id}><div className="os-eyebrow">{id}</div><h3>{t(`${id}.title`)}</h3><p>{t(`${id}.description`)}</p></article>)}</div><article className="os-note"><h3>{t('dynamicTeamTitle')}</h3><p>{t('dynamicTeamBody')}</p><div className="os-flow">{['teamAssign', 'teamReport', 'teamAdjust', 'teamIntegrate'].map(key => <span key={key}>{t(key)}</span>)}</div></article><article className="os-note"><h3>{t('assignment')}</h3><p>{t('assignmentBody')}</p></article><h3>{t('teamResources')}</h3><Assets rows={catalog.organization ?? catalog.tools.filter(row => /subagent|teammate|team_task|list_agents|wait_agent|send_message/.test(row.name))} query="" t={t} /></>}
        {tab === 'verification' && <><VerifierPanel task={task} t={t}/><article className="os-note"><h3>{t('judgeTitle')}</h3><p>{t('judgeBody')}</p><p>{t('verificationBoundary')}</p></article><Assets rows={catalog.verification ?? []} query="" t={t} /><div className="os-grid"><article className="os-feature"><h3>{t('task.review')}</h3><code>dispatch_review → {task?.planningAttempt?.tool ?? 'verifier_compare / verifier_select / verifier_track'}</code><p>{t('proposalEvidence')}</p><pre className="os-report">{task?.review || t('pending')}</pre></article><article className="os-feature"><h3>{t('task.acceptance')}</h3><code>dispatch_accept → verifier_current_session</code><p>{t('acceptanceEvidence')}</p><pre className="os-report">{task?.acceptance || t('pending')}</pre></article></div></>}
        {tab === 'dispatch' && <><div className="os-pipeline">{['planning', 'reaction', 'delivery'].map((id, i) => <div key={id}><span>{i + 1}</span><strong>{t(`workflow.phase.${id}`)}</strong><small>{t(`workflow.phase.${id}.description`)}</small></div>)}</div><article className="os-note"><h3>{t('judgeTitle')}</h3><p>{t('judgeBody')}</p></article><div className="os-toolbar"><label htmlFor="os-session">{t('taskRecords')}</label><select id="os-session" value={scope} onChange={e => changeScope(e.target.value)}><option value="">{t('selectSession')}</option>{options.tasks.map(row => <option key={row.sessionId} value={row.sessionId}>{row.sessionId.slice(-8)} · {row.prompt.slice(0, 48)}</option>)}</select></div>{task && options.sessions.find(row => row.id === scope)?.preset === 'dispatch-orchestrator' ? <div className="os-task"><span className="os-badge">{t(`phase.${task.phase}`)} · {t('turn')} {task.turn}</span><TaskStages key={task.taskId ?? `${task.sessionId}:${task.prompt}`} task={task} t={t} /></div> : <div className="os-empty">{task?.layerSummary || t('noTask')}</div>}</>}
        {catalog.warnings.length > 0 && <details className="os-warning"><summary>{t('warnings')} ({catalog.warnings.length})</summary>{catalog.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
      </>}
    </main></div><footer className="os-footer"><span><span className="os-dot" />{t('catalogHint')}</span><span>{loading && catalog ? t('refreshing') + ' · ' : ''}{catalog ? new Date(catalog.generatedAt).toLocaleTimeString() : '—'}</span></footer>
  </div></div>;
}
function Overlay({ t }: { t: Translate }) { return useSyncExternalStore(subscribe, getOpen, getOpen) ? <Panel t={t} /> : null; }
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(name, { zh, en }), 'orchestrator-suite locale');
  const t = ctx.locale.bind(name);
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'orchestrator-suite', order: 5, label: () => t('entry') }, (props: { wide?: boolean }) => <Surface><button className="os-entry" aria-label={t('entry')} title={t('entry')} onClick={() => setOpen(true)}><Glyph />{props.wide !== false && <span>{t('entry')}</span>}</button></Surface>));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'orchestrator-suite', order: 15 }, () => <Surface><Overlay t={t} /></Surface>));
  ctx.effect(() => () => setOpen(false), 'orchestrator-suite overlay state');
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'orchestrator-suite:progress', order: 25, locale: name }, (props: { sessionId: string; t?: Translate }) => <Surface><ProgressStatus sessionId={props.sessionId} t={props.t ?? t} /></Surface>));
}
