/** Three visible phases with expandable evidence and model understanding. */
import React, { useEffect, useState } from 'react';
import { PHASES, PHASE_STAGES, phaseOf, deliveryBundle, assessmentChecklist, type Stage, type TaskPhase, type TaskRecord } from '../shared';
import { JudgeEvidence } from './verifier';
export type StageTask = Omit<TaskRecord, 'catalog'>;
type Translate = (key: string) => string;
function pretty(value: string): string {
  try { const parsed: unknown = JSON.parse(value); return typeof parsed === 'object' && parsed !== null ? JSON.stringify(parsed, null, 2) : value; } catch { return value; }
}
function evidence(task: StageTask, id: Stage): string {
  switch (id) {
    case 'input': return task.prompt;
    case 'triage': return task.triage;
    case 'compare': return task.comparison;
    case 'verify': return task.review;
    case 'assemble': return task.conclusion;
    case 'trace': return task.delivery?.requirements ?? '';
    case 'construction': return task.delivery?.constructionRequests ?? '';
    case 'accept': return task.acceptance ?? '';
    default: return '';
  }
}
export function TaskStages({ task, t }: { task: StageTask; t: Translate }) {
  const [expanded, setExpanded] = useState<Partial<Record<Stage, boolean>>>({});
  const currentPhase = phaseOf(task.progress.current);
  const assessments = assessmentChecklist(task);
  const [phaseExpanded, setPhaseExpanded] = useState<Partial<Record<TaskPhase, boolean>>>({ [currentPhase]: true });
  useEffect(() => { setPhaseExpanded(previous => ({ ...previous, [currentPhase]: true })); }, [currentPhase]);
  const download = () => {
    const blob = new Blob([JSON.stringify(deliveryBundle(task), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'orchestrator-suite-3.0.3-delivery.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <><p className="os-caption">{t('workflow.advisory')} · {t(`workflow.${task.guidance ?? 'light'}`)}{task.triggerReason && <><br />{task.triggerReason}</>}</p>
    <ol className="os-stage-list" aria-label={t('progress.stages')}>{PHASES.map((phase, index) => <li key={phase}><details className={currentPhase === phase ? 'os-phase os-phase-current' : 'os-phase'} data-phase={phase} open={!!phaseExpanded[phase]} onToggle={event => { const open = event.currentTarget.open; setPhaseExpanded(previous => previous[phase] === open ? previous : { ...previous, [phase]: open }); }}>
      <summary className="os-phase-header"><span>{index + 1}/3</span><strong>{t(`workflow.phase.${phase}`)}</strong><span className="os-phase-assessments">{assessments.filter(a => PHASE_STAGES[phase].includes(a.stage) && a.assessed).length}/{PHASE_STAGES[phase].length} {t('workflow.assessmentCount')}</span><small>{t(`workflow.phase.${phase}.description`)}</small></summary>
      <div className="os-phase-identity"><strong>{t('workflow.identity')}</strong>{task.identities?.filter(r => r.phase === phase).length ? <details><summary>{task.identities.filter(r => r.phase === phase).at(-1)!.identity} · {t(`workflow.identity.${task.identities.filter(r => r.phase === phase).at(-1)!.mode}`)}</summary>{task.identities.filter(r => r.phase === phase).map((r, i) => <div key={i}><p>{t(`stage.${r.stage}`)} · {r.identity} · {r.scale}</p><pre>{r.reason}{'\n'}{r.evidence}</pre></div>)}</details> : <span>{t('workflow.identityPending')}</span>}</div>
      <ol className="os-phase-steps">{PHASE_STAGES[phase].map(id => {
        const step = task.progress.steps.find(step => step.id === id);
        if (!step) return null;
        const value = evidence(task, id);
        const assessed = assessments.find(a => a.stage === id)!.assessed;
        const attempt = id === 'verify' ? task.planningAttempt : id === 'accept' ? task.acceptanceAttempt : undefined;
        const understanding = task.reports?.filter(r => r.stage === id && (!['verify', 'accept'].includes(id) || !!attempt?.id && r.attemptId === attempt.id)).at(-1);
        const latestTodo = task.todoAssessments?.at(-1);
        const assessmentLabel = id === 'todo' ? !assessed ? t('workflow.todoUnassessed') : t(latestTodo?.decision === 'updated' ? 'workflow.todoUpdated' : 'workflow.todoUnchanged') : attempt ? t(`workflow.attempt.${attempt.outcome}`) : assessed ? t('workflow.assessed') : t('workflow.unassessed');
        const issue = step.note || ((step.status === 'degraded' || step.status === 'failed') && task.progress.steps.filter(s => ['degraded', 'failed'].includes(s.status)).length === 1 ? task.progress.error : undefined);
        return <li key={id}><details className={`os-stage-row os-stage-${step.status}`} data-stage={id} open={!!expanded[id]} onToggle={event => {
          const open = event.currentTarget.open;
          setExpanded(previous => previous[id] === open ? previous : { ...previous, [id]: open });
        }} aria-current={id === task.progress.current ? 'step' : undefined}>
          <summary><span className="os-stage-chevron" aria-hidden="true">›</span><span className={`os-status-light os-status-${step.status}`} aria-hidden="true" /><strong>{t(`stage.${id}`)}</strong><span className="os-stage-state">{id === 'todo' || attempt ? assessmentLabel : t(`progress.status.${step.status}`)}</span></summary>
          <div className="os-stage-evidence">
            <p className={assessed ? 'os-assessment-complete' : 'os-assessment-pending'}>{assessmentLabel}{!assessed && <> · {t('workflow.assessmentMissing')}</>}</p>
            {!(id === 'accept' && task.deliveryConclusion) && <div className="os-understanding"><strong>{t(!assessed && understanding ? 'workflow.partialUnderstanding' : 'workflow.understanding')}</strong>{understanding ? <><pre>{understanding.summary}</pre><small>{understanding.source}</small></> : <p className="os-caption">{t('workflow.understandingPending')}</p>}</div>}
            {attempt && <JudgeEvidence attempt={attempt} t={t} />}
            {id === 'assemble' && task.taskUnderstanding && <article><strong>{t('workflow.taskUnderstanding')}</strong><pre>{task.taskUnderstanding}</pre></article>}
            {(id === 'todo' || id === 'execute') && !!task.executionInsights?.length && <details className="os-execution-insights"><summary>{t('workflow.executionInsights')} ({task.executionInsights.length})</summary>{task.executionInsights.map(i=><article key={i.id}><strong>{i.id} · {i.todoIds.join(' · ')}</strong><pre>{i.understanding}{'\n'}{i.evidence}{'\n'}{i.impact}</pre></article>)}</details>}
            {id === 'accept' && task.deliveryConclusion && <article className="os-delivery-conclusion"><strong>{t('workflow.deliveryConclusion')}</strong><pre>{task.deliveryConclusion.completed}{'\n'}{task.deliveryConclusion.implemented}{'\n'}{task.deliveryConclusion.overallEffect}{'\n'}{task.deliveryConclusion.limitations}</pre></article>}
            {id === 'construction' && task.delivery?.construction && <dl>{Object.entries(task.delivery.construction).map(([key,value])=><React.Fragment key={key}><dt>{t(`workflow.construction.${key}`)}</dt><dd><pre>{value}</pre></dd></React.Fragment>)}</dl>}
            {id === 'supplement' ? <div>{task.supplements?.length ? task.supplements.map(r => <article className="os-requirement" key={r.id}><strong>{r.id} · {t(`workflow.requirement.${r.status}`)}{r.duplicateOf && ` → ${r.duplicateOf}`}</strong><pre>{r.prompt}</pre><p>{r.understanding || t('workflow.understandingPending')}</p><p>{r.impact || t('workflow.impactPending')}</p><small>{r.todoIds.join(' · ') || t('workflow.noTodoChange')}</small></article>) : <p>{t('workflow.noSupplements')}</p>}</div>
              : id === 'todo' ? <>{!task.todoAssessments?.length ? <p className="os-assessment-pending">{t('workflow.todoUnassessedReason')}</p> : <div className="os-todo-assessments"><strong>{t('workflow.todoAssessmentHistory')}</strong>{task.todoAssessments.map((a, i) => <article key={i}><strong>{t(`workflow.todoDecision.${a.decision}`)}</strong><pre>{a.understanding}{'\n'}{a.reason}</pre><small>{a.requirementIds.join(' · ')}{a.todoIds.length > 0 && ` → ${a.todoIds.join(' · ')}`}{a.planVersion && ` · ${t('workflow.planVersion')} ${a.planVersion}`}</small></article>)}</div>}{task.todos?.length ? <ul className="os-todos">{task.todos.map(todo => <li key={todo.id}><strong>{todo.id} · {t(`workflow.todo.${todo.status}`)}</strong><p>{todo.text}</p><small>{todo.requirementIds.join(' · ')} · {todo.origin && t('workflow.origin.'+todo.origin)} · {todo.reason}{todo.insightIds?.length ? ' · '+todo.insightIds.join(' · ') : ''}</small>{todo.evidence && <pre>{todo.evidence}</pre>}</li>)}</ul> : <p>{t('workflow.noTodos')}</p>}{!!task.todoChanges?.length && <details><summary>{t('workflow.todoHistory')} ({task.todoChanges.length})</summary><pre>{JSON.stringify(task.todoChanges, null, 2)}</pre></details>}</>
              : id === 'execute' ? <p>{step.startedAt ? t('progress.executionObserved') : t('progress.executionPending')}</p>
              : value ? <pre>{id === 'input' ? value : pretty(value)}</pre> : <p className="os-caption">{['degraded', 'failed', 'paused'].includes(step.status) ? t('progress.noResult') : step.status === 'skipped' ? t('progress.notCalled') : t('pending')}</p>}
            {id === 'assemble' && !!task.planVersions?.length && <details><summary>{t('workflow.planHistory')} ({task.planVersions.length})</summary><pre>{JSON.stringify(task.planVersions, null, 2)}</pre></details>}
            {id === 'trace' && <><p>{task.delivery?.summary}</p><details className="os-prompt-export"><summary>{t('workflow.allPrompts')}</summary><strong>{t('task.prompt')}</strong><pre>{task.prompt}</pre>{task.supplements?.map(r => <div key={r.id}><strong>{r.id} · {t('turn')} {r.turn}</strong><pre>{r.prompt}</pre></div>)}</details><button className="os-export" onClick={download}>{t('workflow.export')}</button><ul>{deliveryBundle(task).gaps.map(gap => <li key={gap}>{gap}</li>)}</ul></>}
            {issue && <div className="os-stage-issue"><strong>{t('progress.reason')}</strong><pre>{issue}</pre></div>}
            {(step.startedAt || step.finishedAt) && <dl className="os-stage-times">{step.startedAt && <><dt>{t('progress.started')}</dt><dd><time dateTime={step.startedAt}>{new Date(step.startedAt).toLocaleString()}</time></dd></>}{step.finishedAt && <><dt>{t('progress.finished')}</dt><dd><time dateTime={step.finishedAt}>{new Date(step.finishedAt).toLocaleString()}</time></dd></>}</dl>}
            {id === 'compare' && !!task.observations?.length && <details className="os-stage-observations"><summary>{t('task.observations')}</summary><pre>{JSON.stringify(task.observations, null, 2)}</pre></details>}
            {id === 'verify' && <p className="os-caption">{t('proposalEvidence')}</p>}
            {id === 'accept' && <p className="os-caption">{t('acceptanceEvidence')}</p>}
          </div>
        </details></li>;
      })}</ol>
    </details></li>)}</ol></>;
}
