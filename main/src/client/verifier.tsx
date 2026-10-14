import React, { useEffect, useState } from 'react';
import { VERIFIER_ROUTE, type TaskRecord, type JudgeAttempt } from '../shared';
type Translate = (key: string) => string;
export function JudgeEvidence({ attempt, t }: { attempt?: JudgeAttempt; t: Translate }) {
  if (!attempt) return <p>{t('verifier.notAttempted')}</p>;
  return <div className="os-verifier-evidence"><strong>{attempt.tool} · {t(`workflow.attempt.${attempt.outcome}`)}</strong><p>{attempt.routeReason}</p><p>{t('verifier.actualModel')}：{attempt.provider && attempt.model ? `${attempt.provider} / ${attempt.model}` : t('verifier.modelUnconfirmed')}</p><p>{t(attempt.toolInvoked ? 'workflow.toolInvoked' : 'workflow.toolNotInvoked')}</p>{attempt.error && <pre>{attempt.error}</pre>}{attempt.evaluation !== undefined && <details><summary>{t('verifier.result')}</summary><pre>{JSON.stringify(attempt.evaluation, null, 2)}</pre></details>}</div>;
}
export function VerifierPanel({ task, t }: { task?: Omit<TaskRecord,'catalog'>; t: Translate }) {
  const [route,setRoute] = useState(task?.verifierSettings?.planningRoute ?? 'auto'), [repeats,setRepeats] = useState(task?.verifierSettings?.repeats ?? 1), [message,setMessage] = useState(''), [saving,setSaving] = useState(false);
  useEffect(() => { setRoute(task?.verifierSettings?.planningRoute ?? 'auto'); setRepeats(task?.verifierSettings?.repeats ?? 1); setMessage(''); },[task?.sessionId, task?.verifierSettings?.planningRoute, task?.verifierSettings?.repeats]);
  const save = async () => {
    if (!task) return; setSaving(true); setMessage('');
    try { const response = await fetch(VERIFIER_ROUTE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:task.sessionId,settings:{planningRoute:route,repeats}}),signal:AbortSignal.timeout(10000)}); const result=await response.json(); if(!response.ok || result?.ok!==true) throw new Error(result?.error || t('fetchFailed')); setMessage(t('verifier.saved')); }
    catch(error) { setMessage(String(error)); } finally { setSaving(false); }
  };
  return <article className="os-verifier-panel"><h3>{t('verifier.title')}</h3><p>{t('verifier.boundary')}</p>{task ? <><div className="os-verifier-controls"><label>{t('verifier.planningRoute')}<select aria-label={t('verifier.planningRoute')} value={route} onChange={e=>setRoute(e.target.value as typeof route)}>{['auto','compare','select','track'].map(id=><option key={id} value={id}>{t(`verifier.route.${id}`)}</option>)}</select></label><label>{t('verifier.repeats')}<select aria-label={t('verifier.repeats')} value={repeats} onChange={e=>setRepeats(Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option></select></label><button onClick={()=>void save()} disabled={saving || task.judgeAttempts?.some(a=>a.outcome==='running')}>{t('verifier.save')}</button></div>{message && <p role="status">{message}</p>}</> : <p>{t('selectScopeForReport')}</p>}<p>{t('verifier.routeHelp')}</p><p>{t('verifier.acceptanceRoute')}：<code>verifier_current_session</code></p><JudgeEvidence attempt={task?.planningAttempt} t={t}/><JudgeEvidence attempt={task?.acceptanceAttempt} t={t}/></article>;
}
