/** Incremental task data; never rewrites the initial prompt or foreign configuration. */
import { STAGES, phaseOf, deliveryBundle, type Stage, type Todo, type TodoAssessment } from '../shared';
import { mark } from './progress';
import type { State } from './index';
import type { Agent, Execution, ToolDescriptor } from './types';

const now = () => new Date().toISOString();
export const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
export function report(state: State, stage: Stage, summary: string, source: string): void {
  const attempt = stage === 'verify' ? state.planningAttempt : stage === 'accept' ? state.acceptanceAttempt : undefined;
  const attemptId = attempt?.finishedAt && attempt.outcome !== 'running' ? attempt.id : undefined;
  const previous = state.reports.at(-1);
  if (previous?.stage === stage && previous.summary === summary && previous.source === source && previous.attemptId === attemptId) return;
  state.reports.push({ stage, summary, source, recordedAt: now(), ...(attemptId ? { attemptId } : {}) });
}
export function savePlan(state: State, plan: string, reason: string, requirementIds: string[] = ['initial']): void {
  if (state.planVersions.at(-1)?.plan !== plan) state.planVersions.push({ version: state.planVersions.length + 1, plan, reason, requirementIds, recordedAt: now() });
  state.conclusion = plan;
  report(state, 'assemble', plan, reason);
}
export function invalidateDelivery(state: State): void {
  state.acceptance = ''; state.delivery = undefined; state.acceptanceAttempt = undefined; state.deliveryConclusion = undefined;
  for (const id of ['trace', 'accept', 'construction'] as const) mark(state.progress, id, 'pending');
}
export function assessTodos(state: State, value: Omit<TodoAssessment, 'recordedAt'>): TodoAssessment {
  const previous = state.todoAssessments.at(-1);
  if (previous) { const { recordedAt: _at, ...body } = previous; if (JSON.stringify(body) === JSON.stringify(value)) return previous; }
  const assessment = { ...value, recordedAt: now() };
  state.todoAssessments.push(assessment);
  report(state, 'todo', `${value.understanding}\n${value.reason}`, '待办评估');
  mark(state.progress, 'todo', value.decision === 'updated' ? 'done' : 'assessed', value.reason);
  return assessment;
}
function arg(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim() || value.length > 100000) throw new Error(`Invalid ${name}`);
  return value;
}
function refs(state: State, value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.some(id => typeof id !== 'string' || id !== 'initial' && !state.supplements.some(r => r.id === id))) throw new Error('requirementIds must reference initial or captured supplement IDs');
  return [...new Set(value)] as string[];
}
export function upsert(state: State, args: Record<string, unknown>, requirementIds: string[]): Todo {
  const text = arg(args, 'text'), reason = arg(args, 'reason');
  const requestedId = args.id;
  if (requestedId !== undefined && typeof requestedId !== 'string') throw new Error('Invalid todo id');
  const existing = requestedId ? state.todos.find(t => t.id === requestedId) : state.todos.find(t => normalize(t.text) === normalize(text));
  if (requestedId && !existing) throw new Error('Unknown todo id');
  const textChanged = existing && normalize(existing.text) !== normalize(text);
  const status = args.status ?? (textChanged ? 'pending' : existing?.status) ?? 'pending';
  if (!['pending', 'active', 'done', 'cancelled'].includes(String(status))) throw new Error('Invalid todo status');
  if (args.evidence !== undefined && typeof args.evidence !== 'string') throw new Error('Invalid evidence');
  const next: Todo = { id: existing?.id ?? `t${state.todos.length + 1}`, text, reason, status: status as Todo['status'], requirementIds: [...new Set([...(existing?.requirementIds ?? []), ...requirementIds])], evidence: args.evidence as string | undefined ?? (textChanged ? undefined : existing?.evidence), updatedAt: existing?.updatedAt ?? now(), origin: args.origin as Todo['origin'] ?? existing?.origin ?? 'model-execution', insightIds: [...new Set([...(existing?.insightIds ?? []), ...(typeof args.insightId === 'string' ? [args.insightId] : [])])] };
  if (existing && JSON.stringify(existing) === JSON.stringify(next)) return existing;
  next.updatedAt = now();
  state.todoChanges.push({ todoId: next.id, before: existing ? structuredClone(existing) : undefined, after: structuredClone(next), recordedAt: now() });
  if (existing) state.todos[state.todos.indexOf(existing)] = next; else state.todos.push(next);
  for (const id of requirementIds) { const r = state.supplements.find(r => r.id === id); if (r && !r.todoIds.includes(next.id)) r.todoIds.push(next.id); }
  state.revision++; invalidateDelivery(state);
  return next;
}
const schema = (properties: object, required: string[]) => ({ type: 'object', properties, required, additionalProperties: false });
const text = { type: 'string' };
export function seedPlanTodos(state: State, value: unknown, noTodoReason?: string): void {
  const items = value === undefined ? noTodoReason ? [] : [{ text: state.conclusion, reason: '从主模型已提交的综合装配规划生成初始事项；执行时继续分解和沉淀。' }] : value;
  if (!Array.isArray(items) || items.length > 40) throw new Error('Invalid plannedTodos');
  if (!items.length && !noTodoReason?.trim()) throw new Error('An empty plannedTodos needs noTodoReason');
  const ids = items.map(row => {
    if (!row || typeof row !== 'object') throw new Error('Invalid planned todo');
    return upsert(state, { ...row, origin: 'plan', status: 'pending' }, ['initial']).id;
  });
  assessTodos(state, { requirementIds: ['initial'], understanding: state.taskUnderstanding || state.conclusion, decision: ids.length ? 'updated' : 'not-needed', reason: noTodoReason || '规划形成初始待办，后续由真实执行理解和用户补充增量更新。', todoIds: ids, planVersion: state.planVersions.at(-1)?.version });
}
export function workflowTools(requireState: (exec: Execution) => { state: State; agent: Agent }, output: ToolDescriptor['output'], accept: (exec: Execution) => Promise<unknown>): ToolDescriptor[] {
  return [
    { name: 'dispatch_report', description: 'Every process step needs explicit user-visible understanding. Record it here, optionally with evidence-based static/dynamic identity, scale and reason. Execution conclusions may be adapted or declined; inspection is not optional. Reports never switch host roles. Verify/accept understanding must be submitted after reading the current attempt result.',
      parameters: schema({ stage: { type: 'string', enum: [...STAGES] }, understanding: text, source: text, identity: text, identityMode: { type: 'string', enum: ['static', 'dynamic'] }, scale: text, evidence: text, reason: text }, ['stage', 'understanding', 'source']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        const stage = arg(args, 'stage') as Stage;
        if (!STAGES.includes(stage)) throw new Error('Unknown stage');
        const understanding = arg(args, 'understanding'), source = arg(args, 'source');
        const identity = args.identity !== undefined ? { identity: arg(args, 'identity'), mode: arg(args, 'identityMode'), scale: arg(args, 'scale'), evidence: arg(args, 'evidence'), reason: arg(args, 'reason') } : undefined;
        if (identity && identity.mode !== 'static' && identity.mode !== 'dynamic') throw new Error('Invalid identityMode');
        report(state, stage, understanding, source);
        if (stage === 'input') mark(state.progress, 'input', 'done');
        if (identity) state.identities.push({ ...identity, mode: identity.mode as 'static' | 'dynamic', stage, phase: phaseOf(stage), recordedAt: now() });
        state.progress.updatedAt = now();
        return { status: 'recorded', understanding, identity, advisory: true };
      } },
    { name: 'dispatch_todo', description: 'Assess and add/update a todo with source requirement IDs (initial or captured r IDs), reason, status and actual completion evidence. Repeated identical submissions do not duplicate todos or history. If no modification is necessary, explicitly use dispatch_todo_assess; absence of changes is never evidence of assessment.',
      parameters: schema({ id: text, text, reason: text, status: { type: 'string', enum: ['pending', 'active', 'done', 'cancelled'] }, requirementIds: { type: 'array', items: text, minItems: 1 }, evidence: text }, ['text', 'reason', 'requirementIds']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        const revision = state.revision;
        const todo = upsert(state, args, refs(state, args.requirementIds));
        if (state.revision === revision) return { status: 'unchanged', todo };
        const assessment = assessTodos(state, { requirementIds: refs(state, args.requirementIds), understanding: todo.text, decision: 'updated', reason: todo.reason, todoIds: [todo.id], planVersion: state.planVersions.at(-1)?.version });
        mark(state.progress, 'execute', 'active');
        return { status: 'recorded', todo, assessment, openTodos: state.todos.filter(t => !['done', 'cancelled'].includes(t.status)).length };
      } },
    { name: 'dispatch_todo_assess', description: 'Explicitly inspect the current plan and todo list and record why no todo change is needed. covered requires actual todo IDs or an existing planVersion; not-needed requires a clear understanding and reason. This produces assessment evidence, never a fabricated todo modification.',
      parameters: schema({ requirementIds: { type: 'array', items: text, minItems: 1 }, understanding: text, decision: { type: 'string', enum: ['covered', 'not-needed'] }, reason: text, todoIds: { type: 'array', items: text }, planVersion: { type: 'integer', minimum: 1 } }, ['requirementIds', 'understanding', 'decision', 'reason', 'todoIds']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        const requirementIds = refs(state, args.requirementIds), understanding = arg(args, 'understanding'), reason = arg(args, 'reason'), decision = arg(args, 'decision');
        if (decision !== 'covered' && decision !== 'not-needed') throw new Error('Invalid todo assessment decision');
        if (!Array.isArray(args.todoIds) || args.todoIds.some(id => typeof id !== 'string' || !state.todos.some(t => t.id === id))) throw new Error('todoIds must reference actual todos');
        if (args.planVersion !== undefined && !state.planVersions.some(p => p.version === args.planVersion)) throw new Error('Unknown planVersion');
        if (decision === 'covered' && !args.todoIds.length && args.planVersion === undefined) throw new Error('Covered assessment requires a real todo or plan reference');
        const assessment = assessTodos(state, { requirementIds, understanding, decision, reason, todoIds: args.todoIds as string[], planVersion: args.planVersion as number | undefined });
        return { status: 'assessed-no-change', assessment, todoChanges: 0 };
      } },
    { name: 'dispatch_adjust', description: 'Inspect each captured follow-up and explicitly assess its plan/todo impact without rerunning initial planning. Supply a todo update, or explicit todoDecision covered/not-needed with reasons in impact. Covered requires a real todoId or planVersion. Merely omitting todo fields does not count as no-change assessment. Duplicate/no-impact never mutate the plan or todos.',
      parameters: schema({ requirementId: text, kind: { type: 'string', enum: ['add', 'change', 'duplicate', 'clarification', 'no-impact'] }, understanding: text, impact: text, todoId: text, todo: text, planUpdate: text, todoDecision: { type: 'string', enum: ['covered', 'not-needed'] }, planVersion: { type: 'integer', minimum: 1 } }, ['requirementId', 'kind', 'understanding', 'impact']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        const r = state.supplements.find(r => r.id === arg(args, 'requirementId'));
        if (!r) throw new Error('Unknown requirementId');
        const kind = arg(args, 'kind') as NonNullable<typeof r.kind>, understanding = arg(args, 'understanding'), impact = arg(args, 'impact');
        if (!['add', 'change', 'duplicate', 'clarification', 'no-impact'].includes(kind)) throw new Error('Invalid adjustment kind');
        if (['duplicate', 'no-impact'].includes(kind) && (args.todo !== undefined || args.planUpdate !== undefined)) throw new Error('Duplicate/no-impact assessments cannot mutate todos or plans');
        const existing = args.todoId !== undefined ? state.todos.find(t => t.id === arg(args, 'todoId')) : undefined;
        if (args.todoId !== undefined && !existing) throw new Error('Unknown todoId');
        const todoText = args.todo !== undefined ? arg(args, 'todo') : undefined;
        const planUpdate = args.planUpdate !== undefined ? arg(args, 'planUpdate') : undefined;
        if (args.planVersion !== undefined && !state.planVersions.some(p => p.version === args.planVersion)) throw new Error('Unknown planVersion');
        const decision = args.todoDecision ?? (!todoText && existing && ['duplicate', 'no-impact'].includes(kind) ? 'covered' : undefined);
        if (!todoText && decision === undefined) return { status: 'needs-todo-assessment', requirementId: r.id, understanding, impact, next: 'Supply an actual todo update or explicit todoDecision covered/not-needed. Covered needs todoId or planVersion; absence of fields never implies assessment.' };
        if (decision !== undefined && decision !== 'covered' && decision !== 'not-needed') throw new Error('Invalid todoDecision');
        if (todoText && decision !== undefined) throw new Error('A todo update cannot also declare no-change todoDecision');
        if (!todoText && decision === 'covered' && !existing && args.planVersion === undefined) throw new Error('Covered adjustment requires an actual todo or plan reference');
        const previousAssessment = state.todoAssessments.filter(a => a.requirementIds.includes(r.id)).at(-1);
        // Idempotent model retries produce no extra plan/todo revisions.
        if (r.status === 'assessed' && r.kind === kind && r.understanding === understanding && r.impact === impact && (!decision || previousAssessment?.decision === decision) && (args.planVersion === undefined || previousAssessment?.planVersion === args.planVersion) && (!existing || r.todoIds.includes(existing.id)) && (!todoText || r.todoIds.some(id => state.todos.find(t => t.id === id)?.text === todoText)) && (!planUpdate || state.conclusion === planUpdate)) return { status: 'unchanged', requirement: r };
        if (todoText) {
          const todo = upsert(state, { id: existing?.id, text: todoText, reason: impact, origin: 'user-supplement', ...(kind === 'change' ? { status: 'pending', evidence: '' } : {}) }, [r.id]);
          if (!r.todoIds.includes(todo.id)) r.todoIds.push(todo.id);
        } else if (existing && !r.todoIds.includes(existing.id)) r.todoIds.push(existing.id);
        if (planUpdate) savePlan(state, planUpdate, impact, [r.id]);
        Object.assign(r, { kind, understanding, impact, status: 'assessed' });
        const assessment = assessTodos(state, { requirementIds: [r.id], understanding, decision: todoText ? 'updated' : decision as 'covered' | 'not-needed', reason: impact, todoIds: [...r.todoIds], planVersion: todoText ? state.planVersions.at(-1)?.version : args.planVersion as number | undefined });
        state.revision++; invalidateDelivery(state); report(state, 'supplement', `${understanding}\n${impact}`, r.id);
        mark(state.progress, 'supplement', state.supplements.some(r => r.status === 'pending') ? 'active' : ['duplicate', 'no-impact'].includes(kind) ? 'assessed' : 'done', impact);
        if (!state.supplements.some(r => r.status === 'pending')) mark(state.progress, 'execute', 'active');
        return { status: 'assessed', requirement: r, todoAssessment: assessment, planVersion: state.planVersions.at(-1), todos: state.todos, planningPreserved: true };
      } },
    { name: 'dispatch_checkpoint', description: 'Re-read the unchanged user prompt, follow-ups, registered-layer comparison, independent evaluation and integrated plan during execution. Read-only; does not call judges or mutate the task. Use dispatch_refine to record deeper execution understanding and its todo impact.', parameters: schema({}, []), output,
      async execute(_args, exec) { const { state } = requireState(exec); exec.signal.throwIfAborted(); return { originalUserPrompt: state.prompt, supplements: state.supplements, comparison: state.comparison, review: state.review, planningAttempt: state.planningAttempt, taskUnderstanding: state.taskUnderstanding, plan: state.conclusion, planVersions: state.planVersions, todos: state.todos, executionInsights: state.executionInsights ?? [] }; } },
    { name: 'dispatch_refine', description: 'Record deeper understanding from actual execution evidence, linked to existing requirements. Add/update todos or explicitly record covered/not-needed; optionally revise the plan incrementally. This never fabricates a user supplement or reruns planning verification.',
      parameters: schema({ understanding: text, evidence: text, impact: text, requirementIds: { type: 'array', items: text, minItems: 1 }, todos: { type: 'array', maxItems: 40, items: schema({ id: text, text, reason: text, status: { type: 'string', enum: ['pending','active','done','cancelled'] }, evidence: text }, ['text','reason']) }, decision: { type: 'string', enum: ['covered','not-needed'] }, todoIds: { type: 'array', items: text }, planUpdate: text }, ['understanding','evidence','impact','requirementIds']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        if (state.judgeAttempts.some(a => a.outcome === 'running')) throw new Error('A judge call is running');
        const requirementIds = refs(state, args.requirementIds), understanding = arg(args,'understanding'), evidence = arg(args,'evidence'), impact = arg(args,'impact');
        const items = args.todos ?? [];
        if (!Array.isArray(items) || items.length > 40 || items.some(row => !row || typeof row !== 'object')) throw new Error('Invalid execution todos');
        const todoIds = args.todoIds ?? [];
        if (!Array.isArray(todoIds) || todoIds.some(id => typeof id !== 'string' || !state.todos.some(t => t.id === id))) throw new Error('Unknown todo reference');
        if (!items.length && !['covered','not-needed'].includes(String(args.decision))) return { status: 'needs-todo-assessment', instruction: 'Submit real todo updates or an explicit covered/not-needed decision.' };
        if (!items.length && args.decision === 'covered' && !todoIds.length) throw new Error('Covered execution insight requires a real todo reference');
        if (args.planUpdate !== undefined) arg(args,'planUpdate');
        // Validate the entire incremental operation on a copy before touching live task state.
        const draft = structuredClone(state), id = `i${(state.executionInsights?.length ?? 0) + 1}`;
        const updated = items.map(row => upsert(draft, { ...row, origin: 'model-execution', insightId: id }, requirementIds));
        const signature = JSON.stringify({ understanding, evidence, impact, requirementIds, items, todoIds, decision: args.decision, planUpdate: args.planUpdate });
        const previous = (state.executionInsights ?? []).at(-1) as (NonNullable<State['executionInsights']>[number] & { signature?: string }) | undefined;
        if (previous?.signature === signature) return { status: 'unchanged', insight: previous };
        if (args.planUpdate) savePlan(draft, args.planUpdate as string, impact, requirementIds);
        const insight = { id, understanding, evidence, impact, requirementIds, todoIds: [...new Set([...todoIds, ...updated.map(t => t.id)])] as string[], recordedAt: now(), signature };
        draft.executionInsights = [...(draft.executionInsights ?? []), insight]; draft.revision++; invalidateDelivery(draft);
        assessTodos(draft, { requirementIds, understanding, decision: items.length ? 'updated' : args.decision as 'covered' | 'not-needed', reason: impact, todoIds: insight.todoIds, planVersion: draft.planVersions.at(-1)?.version });
        report(draft, 'execute', `${understanding}\n证据：${evidence}\n影响：${impact}`, id); mark(draft.progress, 'execute', 'active'); Object.assign(state, draft);
        return { status: 'recorded', insight, todos: state.todos, planningPreserved: true };
      } },
    { name: 'dispatch_conclude', description: 'After reading the current real acceptance attempt, publish what was completed, implemented, overall effect and limitations. Records a dedicated system-prompt conclusion and visible board evidence. A score or failed/unavailable attempt never implies passed acceptance.',
      parameters: schema({ completed: text, implemented: text, overallEffect: text, limitations: text }, ['completed','implemented','overallEffect','limitations']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>, attempt = state.acceptanceAttempt;
        if (!state.delivery || state.delivery.revision !== state.revision || !attempt?.finishedAt || !['evaluated','failed','unavailable'].includes(attempt.outcome) || attempt.revision !== state.revision || attempt.deliveryRevision !== state.delivery.revision) return { status: 'needs-current-acceptance', instruction: 'Submit delivery trace and read its actual verifier_current_session attempt first.' };
        const completed = arg(args,'completed'), implemented = arg(args,'implemented'), overallEffect = arg(args,'overallEffect'), limitations = arg(args,'limitations');
        state.deliveryConclusion = { completed, implemented, overallEffect, limitations, attemptId: attempt.id, revision: state.revision, recordedAt: now() };
        report(state,'accept', `${completed}\n${implemented}\n${overallEffect}\n限制：${limitations}`, 'dispatch_conclude');
        return { status: 'recorded', conclusion: state.deliveryConclusion, independentAttempt: attempt, systemSection: 'orchestrator-suite:delivery-conclusion', userInstruction: 'Present this conclusion to the user; the system section is model context, not a fabricated chat message.' };
      } },
    { name: 'dispatch_delivery', description: '3-1 trace original/follow-up requirements and actual work; 3-2 always invoke dsh-llm-verifier acceptance and then dispatch_conclude; 3-3 separately list missing project items, current problems, suite runtime and improvement suggestions. Never modify the verifier plugin.',
      parameters: schema({ summary: text, requirements: text, constructionRequests: text, missingItems: text, problems: text, suiteStatus: text, suggestions: text }, ['summary', 'requirements', 'constructionRequests']), output,
      async execute(value, exec) {
        const { state } = requireState(exec); exec.signal.throwIfAborted(); const args = value as Record<string, unknown>;
        if (state.progress.steps.some(step => step.status === 'active' && (step.id === 'verify' || step.id === 'accept'))) throw new Error('A judge call is running; inspect its result before delivery submission');
        const summary = arg(args, 'summary'), requirements = arg(args, 'requirements'), constructionRequests = arg(args, 'constructionRequests');
        const constructionKeys = ['missingItems','problems','suiteStatus','suggestions'] as const;
        const construction = constructionKeys.some(key => args[key] !== undefined) ? Object.fromEntries(constructionKeys.map(key => [key, arg(args,key)])) as NonNullable<State['delivery']>['construction'] : undefined;
        if (state.delivery && (state.delivery.summary !== summary || state.delivery.requirements !== requirements || state.delivery.constructionRequests !== constructionRequests || JSON.stringify(state.delivery.construction) !== JSON.stringify(construction))) { state.revision++; invalidateDelivery(state); }
        state.delivery = { summary, requirements, constructionRequests, construction, revision: state.revision, recordedAt: now() };
        report(state, 'execute', state.delivery.summary, 'dispatch_delivery');
        report(state, 'trace', state.delivery.requirements, 'dispatch_delivery'); report(state, 'construction', state.delivery.constructionRequests, 'dispatch_delivery');
        mark(state.progress, 'trace', 'done'); mark(state.progress, 'construction', 'done'); mark(state.progress, 'accept', state.acceptance ? 'done' : 'pending');
        state.progress.current = 'trace';
        const evaluation = await accept(exec);
        return { status: 'recorded', evaluation, report: deliveryBundle(state), instruction: 'Delivery evaluation was actually attempted. Inspect its result/error, then dispatch_report(accept) with your understanding. Report all missing assessments; a returned score never asserts acceptance passed.' };
      } },
    { name: 'dispatch_export', description: 'Return the complete delivery report including unchanged initial prompt, every supplementary prompt, plan versions, todo history, identities, evidence and gaps. Read-only; not a claim that acceptance passed.', parameters: schema({}, []), output,
      async execute(_value, exec) { const { state } = requireState(exec); exec.signal.throwIfAborted(); return deliveryBundle(state); } },
  ];
}
