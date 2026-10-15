import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRuntime, mount } from '../lib/host-3.0.3.js';
import { publicFiles, scanFiles } from '../scripts/privacy-scan.mjs';

const config = JSON.parse(await fs.readFile(new URL('../suite.config.json', import.meta.url), 'utf8'));
function setup({ preset = 'dispatch-orchestrator', verifier, skills = [] } = {}) {
  const events = new Map(), routes = [], registered = [], sections = [], contexts = [];
  const agent = { id: 'main-1', ctx: {}, session: { header: {} } };
  const ctx = {
    logger: { warn() {} }, effect: f => f(), inject: (_n, f) => f(ctx), on: (event, f) => events.set(event, f),
    systemPrompt: { section: s => { sections.push(s); return () => {}; } },
    skills: { list: async () => skills },
    pluginManager: { listBundles: async () => [], listPlugins: async () => [] },
    agentPresets: { composedPreset: () => preset, compositionInventory: async () => [] },
    agents: { get: id => id === agent.id ? agent : undefined, list: () => [agent] },
    tools: { schemas: () => [], register: tool => { registered.push(tool); return () => {}; }, get: () => verifier ? {} : undefined, execute: async args => verifier(args) },
    connection: { fetch: { register: r => { routes.push(r); return async () => {}; } } },
  };
  const settings = { ...config, assetRoots: [], memoryRoots: [] };
  const runtime = createRuntime(ctx, settings);
  const exec = { agent, signal: new AbortController().signal, callId: 'call', token: Symbol(), deferContext: c => contexts.push(c) };
  const capture = (prompt = '原始任务\n保留文本', turn = 1) => runtime.capture({ agent, message: { source: { kind: 'user' }, content: [{ type: 'text', text: prompt }] }, turn });
  const call = (name, args = {}, execution = exec) => runtime.tools.find(t => t.name === name).execute(args, execution);
  capture();
  return { ctx, runtime, agent, exec, call, capture, settings, events, routes, sections, registered, contexts };
}
async function completePlanning(s, conclusion = 'Plan') {
  await s.call('dispatch_plan', { triage: 'L1 测试任务分诊', inputUnderstanding: '理解测试任务范围，过程方案可调整' });
  await s.call('dispatch_review', { triage: 'L1 测试任务分诊', comparison: '已查看当前注册工具、验证、团队协作与身份，未知据实报告' });
  const result = await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion, reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
  assert.equal(result.status, 'ready'); return result;
}
async function understandInput(s) { await s.call('dispatch_report', { stage: 'input', understanding: '理解用户原始目标及约束', source: '测试输入原文' }); }

test('live preset switch removes workflow guidance and preserves foreign middleware result', async () => {
  const s = setup(); let preset = 'dispatch-orchestrator';
  s.ctx.agentPresets.composedPreset = () => preset;
  mount(s.ctx, s.settings);
  s.events.get('agent/inbox/claimed')({ agent: s.agent, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Task' }] }, turn: 1 });
  const assemble = () => s.events.get('system-prompt/assemble')({ sections: [] }, { agent: s.agent }, async () => ({ sections: [{ name: 'team-owned', text: 'Keep team tools available' }] }));
  assert.ok((await assemble()).sections.some(row => row.name === 'orchestrator-suite:task'));
  preset = 'some-other-preset';
  const other = await assemble();
  assert.deepEqual(other.sections.map(row => row.name), ['team-owned', 'orchestrator-suite:layers']);
  assert.equal(s.sections[0].text({ agent: s.agent }), '');
  const result = { kind: 'continue', teamOwnedData: true }; let calls = 0;
  assert.equal(await s.events.get('agent/pre-step')({ agent: s.agent }, async () => { calls++; return result; }), result);
  assert.equal(calls, 1);
  assert.equal((await s.registered.find(t => t.name === 'dispatch_accept').execute({}, s.exec)).status, 'advisory-only');
  const patch = await fs.readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(patch, /planMode:|workflowEngine:|toolFilter:|tool-subagent|tool-workflow|tool-plugin-manager/);
});
test('ordinary presets keep one layer result and never enter dispatch workflow', async () => {
  const s = setup({ preset: 'standard' });
  const before = structuredClone(s.runtime.states.get(s.agent).progress);
  s.runtime.observeStep(s.agent);
  assert.deepEqual(s.runtime.states.get(s.agent).progress, before);
  assert.equal((await s.call('dispatch_plan', { triage: 'irrelevant' })).status, 'advisory-only');
  assert.equal((await s.call('relic_result', { understanding: 'premature' })).status, 'needs-catalog');
  await s.call('relic_prepare');
  assert.equal((await s.call('relic_result', { understanding: '工具与团队按当前预设选用，验证和身份未知' })).status, 'orchestrated');
  s.capture('New supplement', 2);
  assert.equal(s.runtime.states.get(s.agent).supplements.length, 0);
  assert.equal((await s.call('relic_result', { understanding: 'duplicate' })).status, 'already-recorded');
  assert.equal(s.runtime.states.get(s.agent).todos.length, 0);
});

test('missing judge is degraded and commit continues without fabricated success', async () => {
  const s = setup(); await understandInput(s);
  const result = await s.call('dispatch_review', { triage: 'L1', comparison: '发现失败；使用可用工具' });
  assert.equal(result.status, 'degraded');
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: '裁判不可用；记录自检证据继续', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
  const state = s.runtime.states.get(s.agent);
  assert.equal(state.progress.current, 'execute'); assert.equal(state.review, '');
  assert.equal(state.progress.steps.find(s => s.id === 'verify').status, 'degraded');
});
test('registry failure is advisory and does not stop the task', async () => {
  const s = setup(); await s.call('dispatch_plan', { triage: 'L1', inputUnderstanding: '确认目标' }); s.ctx.skills.list = async () => { throw new Error('skills offline'); };
  const result = await s.call('relic_prepare'); assert.match(result.warnings.join(), /skills offline/);
  await s.call('dispatch_context', { comparison: '技能未知', conclusion: '使用现有能力' });
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: '使用现有能力', reviewUnderstanding: '读取和验证存在缺口，明确降级后按可用证据继续' });
  assert.equal(s.runtime.states.get(s.agent).progress.current, 'execute');
});
test('real review carries exact original prompt, stage and actual contexts', async () => {
  let request;
  const s = setup({ verifier: args => { request = args; return { isError: false, value: { winner: 'B', scoreA: .2 }, content: [], additionalContexts: ['judge context'] }; } });
  await s.call('dispatch_review', { triage: 'L1', comparison: '明确依赖' });
  assert.equal(JSON.parse(request.arguments.problem).original_user_prompt, '原始任务\n保留文本');
  assert.equal(request.arguments.review_stage, 'proposal'); assert.deepEqual(s.contexts, ['judge context']);
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: '采纳直接执行基线', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
});
test('steering invalidates an in-flight review and old acceptance', async () => {
  let finish;
  const s = setup({ verifier: () => new Promise(resolve => { finish = resolve; }) });
  await s.call('relic_prepare');
  const pending = s.call('dispatch_review', { triage: 'L1', comparison: '旧任务' });
  s.capture('补充约束', 1); finish({ isError: false, value: {}, content: [] });
  await assert.rejects(pending, /Task changed/);
  assert.equal(s.runtime.states.get(s.agent).review, ''); assert.equal(s.runtime.states.get(s.agent).prompt, '原始任务\n保留文本'); assert.equal(s.runtime.states.get(s.agent).supplements[0].prompt, '补充约束');
});
test('cancellation remains cancellation and cannot commit a fake review', async () => {
  const controller = new AbortController();
  const s = setup({ verifier: () => { controller.abort(); return { isError: false, value: {}, content: [] }; } });
  await assert.rejects(s.call('dispatch_review', { triage: 'L0', comparison: '参考' }, { ...s.exec, signal: controller.signal }));
  assert.equal(s.runtime.states.get(s.agent).progress.steps.find(s => s.id === 'verify').status, 'paused');
});
test('delivery evaluation is distinct and never asserts threshold success', async () => {
  let request;
  const s = setup({ verifier: args => { request = args; return { isError: false, content: [], value: { score: .1, winner: 'B', criteria: [{ score: .1 }] } }; } });
  const result = await s.call('dispatch_accept');
  assert.equal(request.name, 'verifier_current_session'); assert.equal(result.status, 'evaluated');
  assert.equal(result.acceptance.score, .1); assert.equal('passed' in result, false);
  s.runtime.observeStep(s.agent); assert.equal(s.runtime.states.get(s.agent).progress.current, 'accept');
  s.capture('补充需求', 2); assert.equal(s.runtime.states.get(s.agent).acceptance, '');
});
test('missing acceptance tool leaves delivery explicitly unverified', async () => {
  const s = setup(); const result = await s.call('dispatch_accept');
  assert.equal(result.status, 'unverified');
  assert.equal(s.runtime.states.get(s.agent).progress.steps.find(s => s.id === 'accept').status, 'degraded');
});
test('subagent tasks are not captured or exposed as main tasks', async () => {
  const s = setup(); const child = { ...s.agent, id: 'child', session: { header: { parentSession: s.agent.id } } };
  s.runtime.capture({ agent: child, turn: 1, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'child task' }] } });
  await assert.rejects(s.call('dispatch_plan', { triage: 'L0' }, { ...s.exec, agent: child }), /No user-authored/);
});
test('host system messages contain prompt and model reports; route validates scope', async () => {
  const s = setup(); mount(s.ctx, s.settings);
  s.events.get('agent/inbox/claimed')({ agent: s.agent, turn: 1, message: { source: { kind: 'user' }, content: [{ type: 'text', text: '原始请求' }] } });
  await s.registered.find(t => t.name === 'dispatch_plan').execute({ triage: 'L1 证据', inputUnderstanding: '理解原始请求' }, s.exec);
  const assembly = await s.events.get('system-prompt/assemble')({}, { agent: s.agent }, async () => ({ sections: [] }));
  assert.match(assembly.sections[0].text, /原始请求/); assert.match(assembly.sections[0].text, /L1 证据/);
  const route = s.routes.find(r => r.path.endsWith('/progress'));
  assert.equal((await route.fetch(new Request('http://test/progress', { method: 'POST', body: '{"sessionId":"missing"}' }))).status, 404);
  const response = await route.fetch(new Request('http://test/progress', { method: 'POST', body: '{"sessionId":"main-1"}' }));
  assert.equal((await response.json()).task.prompt, '原始请求');
});
test('containment nests owned skills and VENV; unrelated resources stay standalone', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orchestrator-catalog-'));
  try {
    const plugin = path.join(root, 'sample'); await fs.mkdir(path.join(plugin, 'skills', 's'), { recursive: true }); await fs.mkdir(path.join(plugin, '.venv'));
    await fs.writeFile(path.join(plugin, 'package.json'), JSON.stringify({ name: 'sample', dsh: { bundle: {} } }));
    await fs.writeFile(path.join(plugin, 'skills/s/SKILL.md'), 'test'); await fs.writeFile(path.join(plugin, '.venv/pyvenv.cfg'), 'home = test');
    const s = setup({ skills: [{ name: 'owned', description: '', path: path.join(plugin, 'skills/s/SKILL.md'), invocation: { modelInvocable: true } }, { name: 'standalone', description: '', invocation: { modelInvocable: true } }] });
    s.settings.assetRoots = [root];
    s.ctx.pluginManager.listBundles = async () => [{ name: 'sample', enabled: true, rows: [{ rowId: 'mcp-sample', entryId: 'include:mcp-sample', moduleName: 'mcp-client' }] }];
    s.ctx.pluginManager.listPlugins = async () => [{ entryId: 'include:mcp-sample', moduleName: 'mcp-client', enabled: true, fiberPhase: 'active' }];
    const catalog = await s.call('relic_prepare');
    assert.equal(catalog.skills.find(r => r.id === 'owned').ownerId, 'sample', JSON.stringify({ plugins: catalog.plugins, warnings: catalog.warnings })); assert.equal(catalog.skills.find(r => r.id === 'standalone').ownerId, undefined);
    assert.equal(catalog.plugins.find(r => r.id === 'sample').children.length, 3); assert.equal(catalog.environments[0].ownerId, 'sample');
  } finally { await fs.rm(root, { recursive: true }); }
});

test('five-layer catalog discovers public capabilities without calling foreign tools', async () => {
  const s = setup(); let calls = 0;
  s.ctx.tools.schemas = () => [
    { name: 'mcp__synabun__recall', description: 'Read conversation memory' },
    { name: 'memory_status', description: 'Read memory connection status' },
    { name: 'memory_remember', description: 'Write memory' },
    { name: 'fs_search', description: 'Search files' },
    { name: 'verifier_compare', description: 'Proposal check' },
    { name: 'subagent', description: 'Create a worker' },
  ];
  s.ctx.tools.execute = async () => { calls++; throw new Error('No automatic foreign call'); };
  s.ctx.pluginManager.listBundles = async () => [{ name: 'dsh-cosplay', enabled: true }, { name: 'dsh-agent-swarm', enabled: true }, { name: 'memory-connector', enabled: true }];
  const catalog = await s.call('relic_prepare');
  assert.ok(catalog.identity.some(row => row.id === 'dsh-cosplay'));
  assert.ok(catalog.organization.some(row => row.id === 'dsh-agent-swarm'));
  assert.ok(catalog.memory.some(row => row.kind === 'memory-database' && row.toolNames.includes('mcp__synabun__recall')));
  assert.equal(catalog.memory.some(row => row.toolNames?.includes('fs_search')), false);
  assert.equal(catalog.memory.some(row => row.id === 'memory_remember'), false);
  assert.deepEqual(catalog.verification.map(row => [row.name, row.status]), [['verifier_compare', 'available'], ['verifier_current_session', 'unavailable']]);
  assert.equal(catalog.memory.find(row => row.kind === 'memory-system').port, undefined);
  assert.equal(calls, 0);
});
test('memory transport reports are scoped, explicitly sourced and preserved during steering', async () => {
  const s = setup();
  s.ctx.tools.schemas = () => [{ name: 'memory_status', description: 'Memory status' }];
  await s.call('relic_prepare');
  const result = await s.call('relic_record_observation', { layer: 'memory', resourceId: 'memory_status', summary: 'Observed running MCP HTTP endpoint', source: 'memory_status call abc', protocol: 'http', endpoint: 'http://127.0.0.1:8123/mcp' });
  assert.equal(result.port, 8123); assert.equal(result.verification, 'model-reported');
  await s.call('relic_record_observation', { layer: 'memory', resourceId: 'memory_status', summary: 'Actually stdio', source: 'memory_status call def', protocol: 'stdio' });
  assert.equal(s.runtime.states.get(s.agent).observations.length, 1); assert.equal(s.runtime.states.get(s.agent).observations[0].port, undefined);
  await assert.rejects(s.call('relic_record_observation', { layer: 'memory', resourceId: 'unknown', summary: 'No evidence', source: 'guess' }), /Unknown layer resource/);
  await assert.rejects(s.call('relic_record_observation', { layer: 'memory', resourceId: 'memory_status', summary: 'Bad URL', source: 'call', protocol: 'http', endpoint: 'http://user:password@127.0.0.1:1234/mcp' }), /without credentials/);
  await assert.rejects(s.call('relic_record_observation', { layer: 'memory', resourceId: 'memory_status', summary: 'Bad port', source: 'call', protocol: 'stdio', endpoint: 'http://127.0.0.1:1234' }), /no network endpoint/);
  s.capture('New constraints', 2); assert.equal(s.runtime.states.get(s.agent).observations[0].source, 'memory_status call def');
});
test('registry arrays are not mutated and a private optional cwd service is never read', async () => {
  const s = setup(); const rows = Object.freeze([]);
  s.ctx.pluginManager.listPlugins = async () => rows;
  s.ctx.agentPresets.compositionInventory = async () => [{ id: 'dispatch-orchestrator', rows: [{ entryId: 'team', moduleName: 'agent-team', enabled: true, fiberPhase: 'active' }] }];
  Object.defineProperty(s.ctx, 'workingDirectory', { get() { throw new Error('Private service access'); } });
  const catalog = await s.call('relic_prepare');
  assert.ok(catalog.organization.some(row => row.id === 'agent-team')); assert.equal(rows.length, 0);
});
test('five layers enter real system sections and observations only appear in chosen scope', async () => {
  const s = setup(); s.ctx.tools.schemas = () => [{ name: 'memory_status', description: 'Memory status' }];
  mount(s.ctx, s.settings);
  s.events.get('agent/inbox/claimed')({ agent: s.agent, turn: 1, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'Task' }] } });
  const call = (name, args = {}) => s.registered.find(t => t.name === name).execute(args, s.exec);
  await call('relic_prepare'); await call('relic_record_observation', { layer: 'memory', resourceId: 'memory_status', summary: 'stdio running', source: 'public status result', protocol: 'stdio' });
  const assembly = await s.events.get('system-prompt/assemble')({}, { agent: s.agent }, async () => ({ sections: [] }));
  assert.match(assembly.sections[0].text, /verifier_compare/); assert.match(assembly.sections[0].text, /public status result/);
  const board = s.routes.find(row => row.path.endsWith('/board'));
  const scoped = await (await board.fetch(new Request('http://test/board', { method: 'POST', body: JSON.stringify({ sessionId: s.agent.id }) }))).json();
  const global = await (await board.fetch(new Request('http://test/board', { method: 'POST', body: '{}' }))).json();
  assert.ok(scoped.catalog.memory.some(row => row.kind === 'observation'));
  assert.equal(global.catalog.memory.some(row => row.kind === 'observation'), false);
});

test('each degraded stage keeps its own reason and a successful retry clears the old reason', async () => {
  const s = setup(); await understandInput(s);
  s.ctx.skills.list = async () => { throw new Error('Skill registry offline'); };
  await s.call('relic_prepare');
  await s.call('dispatch_review', { triage: 'L1', comparison: 'Explicit unknown skill layer' });
  const state = s.runtime.states.get(s.agent);
  assert.match(state.progress.steps.find(step => step.id === 'compare').note, /Skill registry offline/);
  assert.match(state.progress.steps.find(step => step.id === 'verify').note, /verifier_compare is unavailable/);
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: 'Continue independent implementation', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
  assert.equal(state.progress.current, 'execute');
  assert.match(state.progress.steps.find(step => step.id === 'verify').note, /unavailable/);
  s.ctx.tools.get = () => ({});
  s.ctx.tools.execute = async () => ({ isError: false, value: { winner: 'A' }, content: [] });
  await s.call('dispatch_review', { triage: 'L1', comparison: 'Retry with the same public evidence' });
  assert.equal(state.progress.steps.find(step => step.id === 'verify').note, undefined);
  assert.equal(state.progress.steps.find(step => step.id === 'verify').status, 'done');
  assert.match(state.progress.steps.find(step => step.id === 'compare').note, /Skill registry offline/);
});

test('long-prompt thresholds only suggest initial planning; long follow-ups preserve the baseline', async () => {
  const s = setup(); let state = s.runtime.states.get(s.agent);
  assert.equal(state.guidance, 'light');
  await s.call('dispatch_start', { prompt: 'a'.repeat(599), reason: 'User explicitly requested a separate task' });
  assert.equal(s.runtime.states.get(s.agent).guidance, 'light');
  await s.call('dispatch_start', { prompt: 'a'.repeat(600), reason: 'Explicit new task' });
  state = s.runtime.states.get(s.agent); assert.equal(state.guidance, 'full');
  await completePlanning(s, 'Direct work after explicit assessment');
  assert.equal(state.planVersions.length, 1); const baseline = state.prompt, id = state.taskId;
  s.capture('b'.repeat(2000), 7);
  assert.equal(state.prompt, baseline); assert.equal(state.taskId, id); assert.equal(state.conclusion, 'Direct work after explicit assessment');
  assert.equal(state.supplements[0].status, 'pending'); assert.equal(state.progress.current, 'supplement');
  await s.call('dispatch_start', { prompt: ['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30), 'd'.repeat(30)].join('\n\n'), reason: 'Explicit new task' });
  assert.equal(s.runtime.states.get(s.agent).guidance, 'full');
});

test('incremental adjustment revises only linked work, versions the plan and preserves actual planning review', async () => {
  const s = setup({ verifier: () => ({ isError: false, value: { score: .8 }, content: [] }) });
  await understandInput(s);
  await s.call('dispatch_review', { triage: 'L1', comparison: 'Registered tools and identities' });
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: 'Plan one', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
  const base = await s.call('dispatch_todo', { text: 'Implement board', reason: 'Initial requirement', requirementIds: ['initial'] });
  await s.call('dispatch_todo', { id: base.todo.id, text: 'Implement board', reason: 'Implemented', requirementIds: ['initial'], status: 'done', evidence: 'Board checks passed' });
  const state = s.runtime.states.get(s.agent), review = state.review, original = state.prompt;
  s.capture('Board must group three phases', 2);
  const args = { requirementId: 'r1', kind: 'change', understanding: 'Group the board by phase', impact: 'Revise the existing board todo', todoId: base.todo.id, todo: 'Implement three-phase board', planUpdate: 'Plan two with grouped phases' };
  await s.call('dispatch_adjust', args);
  assert.equal(state.review, review); assert.equal(state.prompt, original); assert.equal(state.planVersions.length, 2);
  assert.equal(state.todos.length, 1); assert.equal(state.todos[0].status, 'pending'); assert.equal(state.todos[0].evidence, '');
  assert.deepEqual(state.todos[0].requirementIds, ['initial', 'r1']);
  const history = state.todoChanges.length, revision = state.revision;
  assert.equal((await s.call('dispatch_adjust', args)).status, 'unchanged');
  assert.equal(state.todoChanges.length, history); assert.equal(state.revision, revision);
});

test('exact and semantic duplicates preserve every prompt without duplicating todo or plan changes', async () => {
  const s = setup(); await completePlanning(s);
  await s.call('dispatch_todo', { text: 'Add export', reason: 'Initial task', requirementIds: ['initial'] });
  const state = s.runtime.states.get(s.agent), count = state.todoChanges.length;
  s.capture('Support download', 2);
  await s.call('dispatch_adjust', { requirementId: 'r1', kind: 'duplicate', understanding: 'Export is already planned', impact: 'No todo change', todoId: 't1' });
  s.capture('Support download', 3);
  assert.equal(state.supplements.length, 2); assert.equal(state.supplements[1].duplicateOf, 'r1');
  assert.equal(state.supplements[1].status, 'pending');
  await s.call('dispatch_adjust', { requirementId: 'r2', kind: 'duplicate', understanding: '查看后确认与 r1 相同，已有 t1 覆盖', impact: '待办不变', todoId: 't1' });
  assert.deepEqual(state.supplements[1].todoIds, ['t1']); assert.equal(state.todoChanges.length, count); assert.equal(state.planVersions.length, 1);
  await assert.rejects(s.call('dispatch_adjust', { requirementId: 'r1', kind: 'duplicate', understanding: 'Repeated', impact: 'No change', todo: 'Another todo' }), /cannot mutate/);
  assert.equal(state.todoChanges.length, count);
});

test('bad adjustment references do not partially mutate requirements, plans or todos', async () => {
  const s = setup(); s.capture('Extra constraint', 2); const state = s.runtime.states.get(s.agent), before = JSON.stringify(state);
  await assert.rejects(s.call('dispatch_adjust', { requirementId: 'r1', kind: 'change', understanding: 'Change', impact: 'Scope', todoId: 'missing', todo: 'Change item', planUpdate: 'Bad plan' }), /Unknown todoId/);
  assert.equal(JSON.stringify(state), before);
  await assert.rejects(s.call('dispatch_todo', { text: 'Bad source', reason: 'Uncaptured', requirementIds: ['missing'] }), /must reference/);
  assert.equal(JSON.stringify(state), before);
});

test('acceptance rejects late evidence after a supplement and cannot overwrite a newer evaluation', async () => {
  let finish; let calls = 0;
  const s = setup({ verifier: () => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : { isError: false, value: { marker: 'current' }, content: [] } });
  const old = s.call('dispatch_accept'); s.capture('New acceptance criterion', 2);
  await s.call('dispatch_adjust', { requirementId: 'r1', kind: 'no-impact', todoDecision: 'not-needed', understanding: 'Already covered', impact: 'Evidence still applies' });
  await s.call('dispatch_accept');
  const state = s.runtime.states.get(s.agent), latest = state.acceptance;
  finish({ isError: false, value: { marker: 'stale' }, content: [] });
  await assert.rejects(old, /stale/);
  assert.equal(state.acceptance, latest); assert.match(state.acceptance, /current/);
});

test('identity reports show evidence-based changes by phase and scale without foreign role writes', async () => {
  const s = setup();
  await s.call('dispatch_report', { stage: 'triage', understanding: 'Assess scope', source: 'Initial request', identity: 'Planner', identityMode: 'static', scale: 'L1', evidence: 'Two modules', reason: 'Stable planning responsibility' });
  await s.call('dispatch_report', { stage: 'execute', understanding: 'Integrate workers', source: 'Actual progress', identity: 'Integrator', identityMode: 'dynamic', scale: 'L2', evidence: 'Dependency grew to three modules', reason: 'Now coordinate integration' });
  await s.call('dispatch_report', { stage: 'trace', understanding: 'Trace every requirement', source: 'Completed evidence', identity: 'Acceptance lead', identityMode: 'dynamic', scale: 'L2', evidence: 'Delivery checks', reason: 'Focus shifts to requirement coverage' });
  const state = s.runtime.states.get(s.agent);
  assert.deepEqual(state.identities.map(r => r.phase), ['planning', 'reaction', 'delivery']);
  assert.deepEqual(state.identities.map(r => r.identity), ['Planner', 'Integrator', 'Acceptance lead']);
  assert.equal(state.reports.length, 3);
});

test('delivery export preserves exact full prompts, trace, todo history and separate construction requests', async () => {
  const s = setup(); const original = s.runtime.states.get(s.agent).prompt;
  s.capture('Extra request\n\nPreserve exact formatting', 2);
  await s.call('dispatch_adjust', { requirementId: 'r1', kind: 'add', understanding: 'New output', impact: 'One extra todo', todo: 'Export report' });
  await s.call('dispatch_todo', { id: 't1', text: 'Export report', reason: 'Implemented', requirementIds: ['r1'], status: 'done', evidence: 'Export fixture round-trip' });
  await s.call('dispatch_delivery', { summary: 'Shipped', requirements: 'Initial and r1 mapped to output evidence', constructionRequests: 'Future persistence enhancement' });
  const result = await s.call('dispatch_export');
  assert.equal(result.originalUserPrompt, original); assert.equal(result.processUserPrompts[0].prompt, 'Extra request\n\nPreserve exact formatting');
  assert.equal(result.delivery.constructionRequests, 'Future persistence enhancement'); assert.equal(result.todoChanges.length, 2);
  assert.ok(result.gaps.includes('Independent acceptance attempted: unavailable')); assert.ok(result.gaps.includes('Assessment missing: input')); assert.equal(result.workflowComplete, false);
  s.capture('Additional acceptance requirement', 3);
  const changed = await s.call('dispatch_export');
  assert.ok(changed.gaps.includes('Unassessed requirement: r2')); assert.ok(changed.gaps.includes('Delivery trace missing or stale'));
});

test('brief tasks still require assessment and cannot silently assemble an unassessed plan', async () => {
  const s = setup(); const state = s.runtime.states.get(s.agent);
  assert.equal(state.guidance, 'light'); assert.equal(state.progress.steps.find(r => r.id === 'triage').status, 'active'); assert.equal(state.progress.steps.some(r => r.status === 'skipped'), false);
  assert.equal(state.reports.length, 0); s.runtime.observeStep(s.agent); assert.equal(state.progress.current, 'input');
  const result = await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: 'Proceed with direct reversible work', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' });
  assert.equal(result.status, 'needs-assessment'); assert.equal(state.phase, 'discovered'); assert.equal(state.planVersions.length, 0); assert.equal(state.triage, ''); assert.equal(state.comparison, '');
});

test('an exact repeat arriving before assessment does not hide the pending original supplement', async () => {
  const s = setup(); s.capture('New capability', 2); s.capture('New capability', 3);
  const state = s.runtime.states.get(s.agent);
  assert.equal(state.progress.current, 'supplement'); assert.equal(state.progress.steps.find(step => step.id === 'supplement').status, 'active');
  await s.call('dispatch_adjust', { requirementId: 'r1', kind: 'add', understanding: 'Add capability', impact: 'One new todo', todo: 'Build capability' });
  assert.equal(state.supplements[1].status, 'pending'); assert.equal(state.progress.current, 'supplement');
  await s.call('dispatch_adjust', { requirementId: 'r2', kind: 'duplicate', understanding: '已查看，与 r1 相同', impact: '已在 t1 中，不改待办', todoId: 't1' });
  assert.deepEqual(state.supplements[1].todoIds, ['t1']); assert.equal(state.progress.current, 'execute');
});

test('identical todo and plan retries preserve a completed delivery instead of reopening execution', async () => {
  const s = setup({ verifier: () => ({ isError: false, value: { score: .9 }, content: [] }) });
  await completePlanning(s);
  const args = { text: 'Complete feature', reason: 'Done', status: 'done', requirementIds: ['initial'], evidence: 'Feature checks passed' };
  await s.call('dispatch_todo', args);
  await s.call('dispatch_delivery', { summary: 'Feature shipped', requirements: 'Initial scope checked', constructionRequests: 'None' });
  await s.call('dispatch_accept'); const state = s.runtime.states.get(s.agent), before = JSON.stringify(state);
  assert.equal((await s.call('dispatch_todo', args)).status, 'unchanged');
  assert.equal((await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: 'Plan', reviewUnderstanding: '说明实际评价或不可用结果，并按可用证据继续' })).status, 'unchanged');
  assert.equal(JSON.stringify(state), before);
});

test('compatibility context actually attempts planning review and cannot bypass understanding before assembly', async () => {
  const calls = [];
  const s = setup({ verifier: args => { calls.push(args.name); return { isError: false, value: { winner: 'B' }, content: [] }; } });
  await s.call('dispatch_plan', { inputUnderstanding: '理解目标和约束', triage: 'L1，采用直接实现' });
  const result = await s.call('dispatch_context', { comparison: '已看四层公开注册能力，团队无授权不委派', conclusion: '拟采用直接实现' });
  assert.equal(result.status, 'review-required'); assert.deepEqual(calls, ['verifier_compare']);
  const state = s.runtime.states.get(s.agent); assert.equal(state.phase, 'reviewed'); assert.equal(state.conclusion, ''); assert.equal(state.planVersions.length, 0);
  const missing = await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: '拟采用直接实现' }); assert.equal(missing.status, 'needs-assessment');
  await s.call('dispatch_commit', { noTodoReason: '旧回归夹具：这里只测试计划记录，待办在后续步骤显式提交', conclusion: '采纳直接实现方案', reviewUnderstanding: '看过真实评价，选择 B，说明采纳直接实施的理由' });
  assert.equal(state.phase, 'ready'); assert.equal(state.planVersions.length, 1); assert.deepEqual(calls, ['verifier_compare']);
});

test('explicit empty planning todos are assessed, and later covering decisions preserve the plan', async () => {
  const s = setup(); await completePlanning(s);
  const state = s.runtime.states.get(s.agent);
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'todo').assessed, true);
  const versions = state.planVersions.length, changes = state.todoChanges.length, revision = state.revision;
  const args = { requirementIds: ['initial'], understanding: '已看当前规划；本轮是流程说明，没有待执行文件事项', decision: 'covered', reason: '目标已在规划版本 1 中体现，无需新增待办', todoIds: [], planVersion: 1 };
  const result = await s.call('dispatch_todo_assess', args); assert.equal(result.status, 'assessed-no-change');
  assert.equal(state.todoChanges.length, changes); assert.equal(state.planVersions.length, versions); assert.equal(state.revision, revision);
  assert.equal(state.todoAssessments.at(-1).planVersion, 1); assert.equal(state.progress.steps.find(a => a.id === 'todo').status, 'assessed');
  const assessments = state.todoAssessments.length; await s.call('dispatch_todo_assess', args); assert.equal(state.todoAssessments.length, assessments);
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'todo').assessed, true);
  const before = JSON.stringify(state); await assert.rejects(s.call('dispatch_todo_assess', { ...args, planVersion: 99 }), /Unknown planVersion/); assert.equal(JSON.stringify(state), before);
});

test('possible exact repeats need a real model assessment; they do not auto-complete the reaction step', async () => {
  const s = setup(); await completePlanning(s); await s.call('dispatch_todo', { text: 'Existing work', reason: 'Initial scope', requirementIds: ['initial'] });
  s.capture('Existing work', 2); s.capture('Existing work', 3);
  const state = s.runtime.states.get(s.agent), count = state.todoChanges.length;
  assert.equal(state.supplements[1].duplicateOf, 'r1'); assert.equal(state.supplements[1].status, 'pending'); assert.equal(state.todoAssessments.length, 2);
  for (const requirementId of ['r1', 'r2']) await s.call('dispatch_adjust', { requirementId, kind: 'duplicate', understanding: '读过本条输入，t1 已覆盖', impact: '明确保持待办与计划不变', todoId: 't1' });
  assert.equal(state.todoChanges.length, count); assert.equal(state.planVersions.length, 1); assert.equal(state.todoAssessments.length, 4);
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'todo').assessed, true);
});

test('delivery always issues actual acceptance and repeats neither a completed nor failed attempt implicitly', async () => {
  const calls = [];
  const s = setup({ verifier: args => { calls.push(args); return { isError: false, value: { score: .1 }, content: [] }; } });
  const args = { summary: 'Actual output summary', requirements: 'Prompt to output trace', constructionRequests: 'No separate request' };
  const result = await s.call('dispatch_delivery', args);
  assert.deepEqual(calls.map(c => c.name), ['verifier_current_session']); assert.deepEqual(calls[0].arguments, { repeats: 1 });
  assert.equal(result.evaluation.status, 'evaluated'); assert.equal(result.evaluation.acceptance.score, .1); assert.equal('passed' in result.evaluation, false);
  const state = s.runtime.states.get(s.agent); assert.equal(state.acceptanceAttempt.toolInvoked, true); assert.equal(state.acceptanceAttempt.outcome, 'evaluated');
  assert.equal(result.report.assessments.find(a => a.stage === 'accept').assessed, false);
  await s.call('dispatch_report', { stage: 'accept', understanding: '已读低分结果，明确反馈不足而不宣称通过', source: 'verifier_current_session actual result' });
  await s.call('dispatch_conclude', {completed:'已提交真实交付记录',implemented:'已有范围的成果',overallEffect:'独立评价不足或失败，未声称通过',limitations:'保留当前真实验收缺口'});
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'accept').assessed, true);
  await s.call('dispatch_delivery', args); assert.equal(calls.length, 1);
});

test('failed acceptance still counts as an actual attempt, exposes the failure and needs model interpretation', async () => {
  let calls = 0;
  const s = setup({ verifier: () => { calls++; return { isError: true, content: [{ type: 'text', text: 'Judge request failed' }] }; } });
  const args = { summary: 'Output', requirements: 'Scope trace', constructionRequests: 'None' };
  const result = await s.call('dispatch_delivery', args), state = s.runtime.states.get(s.agent);
  assert.equal(calls, 1); assert.equal(result.evaluation.status, 'unverified'); assert.equal(state.acceptanceAttempt.outcome, 'failed'); assert.equal(state.acceptanceAttempt.toolInvoked, true);
  assert.match(state.acceptanceAttempt.error, /Judge request failed/); assert.equal(state.acceptance, '');
  await s.call('dispatch_report', { stage: 'accept', understanding: '实际调用失败，保留自检证据与独立验收缺口', source: 'Failed actual invocation' });
  await s.call('dispatch_conclude', {completed:'已提交真实交付记录',implemented:'已有范围的成果',overallEffect:'独立评价不足或失败，未声称通过',limitations:'保留当前真实验收缺口'});
  const report = await s.call('dispatch_export'); assert.equal(report.assessments.find(a => a.stage === 'accept').assessed, true);
  assert.ok(report.gaps.includes('Independent acceptance attempted: failed'));
  await s.call('dispatch_delivery', args); assert.equal(calls, 1);
});

test('unregistered acceptance is looked up and recorded honestly rather than skipped or fabricated as invoked', async () => {
  const s = setup(); let checks = 0; s.ctx.tools.get = name => { assert.equal(name, 'verifier_current_session'); checks++; return undefined; };
  const result = await s.call('dispatch_delivery', { summary: 'Output', requirements: 'Trace', constructionRequests: 'None' });
  assert.equal(checks, 1); assert.equal(result.evaluation.status, 'unverified');
  const state = s.runtime.states.get(s.agent); assert.equal(state.acceptanceAttempt.outcome, 'unavailable'); assert.equal(state.acceptanceAttempt.toolInvoked, false);
  assert.equal(state.progress.steps.find(a => a.id === 'accept').status, 'degraded'); assert.match(state.acceptanceAttempt.error, /unavailable/);
});

test('complete ordered assessment covers all eleven steps while a low judge score never means passed', async () => {
  const calls = [];
  const s = setup({ verifier: args => { calls.push(args.name); return { isError: false, value: { score: .1 }, content: [] }; } });
  await completePlanning(s, 'Integrated plan from the inspected proposal');
  await s.call('dispatch_report', { stage: 'supplement', understanding: '截至当前没有新增需求，先按初始计划推进', source: 'Current captured prompt set' });
  await s.call('dispatch_todo', { text: 'Deliver the original scope', reason: 'Initial requirement', requirementIds: ['initial'], status: 'done', evidence: 'Actual fixture output checks' });
  await s.call('dispatch_delivery', { summary: 'Scope delivered with checks', requirements: 'Initial request → actual output checks', constructionRequests: 'No further independent request' });
  const pending = await s.call('dispatch_export'); assert.equal(pending.workflowComplete, false); assert.deepEqual(pending.assessments.filter(a => !a.assessed).map(a => a.stage), ['accept']);
  await s.call('dispatch_report', { stage: 'accept', understanding: '验收已调用但分数低，解释未通过的反馈而非假称成功', source: 'Actual judge result' });
  await s.call('dispatch_conclude', {completed:'已提交真实交付记录',implemented:'已有范围的成果',overallEffect:'独立评价不足或失败，未声称通过',limitations:'保留当前真实验收缺口'});
  const result = await s.call('dispatch_export'); assert.equal(result.workflowComplete, true); assert.deepEqual(calls, ['verifier_compare', 'verifier_current_session']); assert.equal(result.assessments.length, 11); assert.equal('passed' in result, false);
});

test('short input assembly reads the registered catalog and injects missing step guidance, never automatic understanding', async () => {
  const s = setup(); let reads = 0; s.ctx.skills.list = async () => { reads++; return []; }; mount(s.ctx, s.settings);
  s.events.get('agent/inbox/claimed')({ agent: s.agent, turn: 1, message: { source: { kind: 'user' }, content: [{ type: 'text', text: 'short task' }] } });
  const result = await s.events.get('system-prompt/assemble')({}, { agent: s.agent }, async () => ({ sections: [] }));
  assert.equal(reads, 1); assert.match(result.sections[0].text, /short\/light/); assert.match(result.sections[0].text, /nextAssessment/); assert.match(result.sections[0].text, /智能体开展任务的过程/);
  const route = s.routes.find(r => r.path.endsWith('/progress')), payload = await (await route.fetch(new Request('http://test/progress', { method: 'POST', body: '{"sessionId":"main-1"}' }))).json();
  assert.equal(payload.version, '3.0.3'); assert.equal(payload.task.discoveryAttempted, true); assert.equal(payload.task.reports.length, 0); assert.equal(payload.assessments[0].assessed, false);
});

test('understanding from an older evaluation cannot substitute for reading the current result', async () => {
  const s = setup({ verifier: () => ({ isError: false, value: { score: .3 }, content: [] }) });
  await s.call('dispatch_accept');
  await s.call('dispatch_report', { stage: 'accept', understanding: '已看首次结果', source: 'First actual result' });
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'accept').assessed, true);
  const state = s.runtime.states.get(s.agent), firstId = state.acceptanceAttempt.id;
  await s.call('dispatch_accept'); assert.notEqual(state.acceptanceAttempt.id, firstId);
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'accept').assessed, false);
  assert.equal(state.judgeAttempts.length, 2); assert.match(state.judgeAttempts[0].result, /score/);
  await s.call('dispatch_report', { stage: 'accept', understanding: '已看本次实际评价，与旧理解区分', source: 'Second actual result' });
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'accept').assessed, true);
});

test('a premature understanding submitted while evaluation runs is not treated as reading its eventual result', async () => {
  let resolveJudge;
  const s = setup({ verifier: () => new Promise(resolve => { resolveJudge = resolve; }) });
  const pending = s.call('dispatch_accept');
  await s.call('dispatch_report', { stage: 'accept', understanding: '准备查看结果', source: 'Preliminary intention' });
  resolveJudge({ isError: false, value: { score: .5 }, content: [] }); await pending;
  assert.equal((await s.call('dispatch_export')).assessments.find(a => a.stage === 'accept').assessed, false);
});

test('omitting todo fields never implies coverage merely because an earlier plan exists', async () => {
  const s = setup(); await completePlanning(s); s.capture('New follow-up criterion', 2);
  const state = s.runtime.states.get(s.agent), before = JSON.stringify(state);
  const result = await s.call('dispatch_adjust', { requirementId:'r1',kind:'clarification',understanding:'解释当前需求',impact:'需要看待办是否包含' });
  assert.equal(result.status, 'needs-todo-assessment'); assert.equal(JSON.stringify(state), before);
  await s.call('dispatch_adjust', { requirementId:'r1',kind:'no-impact',understanding:'已经对照规划',impact:'已在规划1中，待办不变',todoDecision:'covered',planVersion:1 });
  assert.equal(state.supplements[0].status, 'assessed'); assert.equal(state.todoAssessments.at(-1).decision, 'covered'); assert.equal(state.todoAssessments[0].planVersion, 1); assert.equal(state.todoChanges.length, 0);
});

test('explicit reports already submitted through the generic tool satisfy understanding without redundant resubmission', async () => {
  const s=setup(); await understandInput(s);
  assert.equal((await s.call('dispatch_plan',{triage:'L1'})).triage,'L1');
  await s.call('dispatch_review',{triage:'L1',comparison:'已检查四层，验证工具不可用据实报告'});
  await s.call('dispatch_report',{stage:'verify',understanding:'已看不可用结果，保留降级并执行可完成事项',source:'Actual unavailable attempt'});
  const result=await s.call('dispatch_commit',{conclusion:'按可用证据执行，不指定强制项目方法'});
  assert.equal(result.status,'ready');
});

test('changed delivery evidence invalidates the previous result while an identical report reuses it', async () => {
  let calls=0;const s=setup({verifier:()=>{calls++;return{isError:false,value:{score:.5},content:[]};}});
  const args={summary:'Output one',requirements:'Initial scope trace',constructionRequests:'None'};
  await s.call('dispatch_delivery',args); await s.call('dispatch_report',{stage:'accept',understanding:'已读当前评价',source:'Actual result'});
  const state=s.runtime.states.get(s.agent),firstId=state.acceptanceAttempt.id;
  await s.call('dispatch_delivery',args);assert.equal(calls,1);
  await s.call('dispatch_delivery',{...args,summary:'Corrected output and new check evidence'});
  assert.equal(calls,2);assert.notEqual(state.acceptanceAttempt.id,firstId);assert.equal(state.acceptanceAttempt.deliveryRevision,state.delivery.revision);
  assert.equal((await s.call('dispatch_export')).assessments.find(a=>a.stage==='accept').assessed,false);
});

test('an evaluation made before the delivery trace does not bypass the actual delivery-stage attempt', async()=>{
  let calls=0;const s=setup({verifier:()=>{calls++;return{isError:false,value:{score:.4},content:[]};}});
  await s.call('dispatch_accept');const first=s.runtime.states.get(s.agent).acceptanceAttempt;
  assert.equal(first.deliveryRevision,undefined);
  await s.call('dispatch_delivery',{summary:'Output',requirements:'Full delivery trace now submitted',constructionRequests:'None'});
  const state=s.runtime.states.get(s.agent);assert.equal(calls,2);assert.notEqual(state.acceptanceAttempt.id,first.id);assert.equal(state.acceptanceAttempt.deliveryRevision,state.delivery.revision);
});

test('a validator that becomes registered after an unavailable attempt is actually invoked on delivery retry', async()=>{
  let available=false,calls=0;const s=setup();s.ctx.tools.get=()=>available?{}:undefined;s.ctx.tools.execute=async()=>{calls++;return{isError:false,value:{score:.7},content:[]};};
  const args={summary:'Output',requirements:'Trace',constructionRequests:'None'};
  await s.call('dispatch_delivery',args);assert.equal(s.runtime.states.get(s.agent).acceptanceAttempt.outcome,'unavailable');assert.equal(calls,0);
  available=true;await s.call('dispatch_delivery',args);assert.equal(calls,1);assert.equal(s.runtime.states.get(s.agent).acceptanceAttempt.toolInvoked,true);
  await s.call('dispatch_delivery',args);assert.equal(calls,1);
});

// 3.0.3 integration regressions: all judge responses below are explicit fixtures.
test('planning routes real candidates and one-based checkpoints, retaining actual judge models', async () => {
  const calls=[];const s=setup({verifier:args=>{calls.push(args);return {isError:false,content:[],value:{provider:'fixture-provider',model:'fixture-judge',scores:[.4,.6],judges:[{model:'fixture-secondary'}]}};}});
  await s.call('dispatch_review',{triage:'Task triage',comparison:'Actual layers',candidates:['Plan A','Plan B','Plan C']});
  assert.equal(calls.at(-1).name,'verifier_select');assert.equal(calls.at(-1).arguments.review_stage,'proposal');assert.equal(s.runtime.states.get(s.agent).planningAttempt.model,'fixture-judge');
  await s.call('dispatch_verifier_settings',{planningRoute:'track',repeats:1});
  const before=JSON.stringify(s.runtime.states.get(s.agent));await assert.rejects(s.call('dispatch_review',{triage:'T',comparison:'C',steps:['Step A','Step B'],checkpoints:[0]}),/one-based/);assert.equal(JSON.stringify(s.runtime.states.get(s.agent)),before);
  await s.call('dispatch_review',{triage:'T',comparison:'C',steps:['Actual step A','Actual step B'],checkpoints:[1,2]});assert.equal(calls.at(-1).name,'verifier_track');assert.deepEqual(calls.at(-1).arguments.checkpoints,[1,2]);
  await s.call('dispatch_verifier_settings',{planningRoute:'select',repeats:1});await assert.rejects(s.call('dispatch_review',{triage:'T',comparison:'C'}),/three real/);assert.equal(calls.length,2);
});
test('integrated concrete plan seeds todos; invalid batch cannot partially assemble', async()=>{
  const s=setup();await s.call('dispatch_plan',{inputUnderstanding:'Understand scope',triage:'T'});await s.call('dispatch_review',{triage:'T',comparison:'C'});
  const before=JSON.stringify(s.runtime.states.get(s.agent));await assert.rejects(s.call('dispatch_commit',{conclusion:'Concrete implementation and validation plan',reviewUnderstanding:'Verifier unavailable',plannedTodos:[{text:'Valid task',reason:'Scope'},{text:'',reason:'Bad'}]}));assert.equal(JSON.stringify(s.runtime.states.get(s.agent)),before);
  await s.call('dispatch_commit',{conclusion:'Concrete implementation and validation plan',taskUnderstanding:'Understood user scope and constraints',reviewUnderstanding:'Verifier unavailable'});const state=s.runtime.states.get(s.agent);assert.equal(state.todos.length,1);assert.equal(state.todos[0].text,state.conclusion);assert.equal(state.todos[0].origin,'plan');assert.equal(state.todos[0].status,'pending');
  await s.call('dispatch_commit',{conclusion:state.conclusion,taskUnderstanding:state.taskUnderstanding,reviewUnderstanding:'Verifier unavailable'});assert.equal(state.todos.length,1);
});
test('execution insight changes todos and plan without fabricating supplements or repeating review',async()=>{
  const s=setup();await completePlanning(s);const state=s.runtime.states.get(s.agent),original=state.prompt,planningAttempt=state.planningAttempt.id;
  const args={understanding:'Execution revealed an uncovered edge case',evidence:'Fixture failing edge-case assertion',impact:'Add a validation task',requirementIds:['initial'],todos:[{text:'Validate uncovered edge case',reason:'Execution evidence',status:'active'}],planUpdate:'Original scope plus edge-case validation'};
  await s.call('dispatch_refine',args);assert.equal(state.supplements.length,0);assert.equal(state.prompt,original);assert.equal(state.executionInsights.length,1);assert.equal(state.todos[0].origin,'model-execution');assert.deepEqual(state.todos[0].insightIds,['i1']);assert.equal(state.planningAttempt.id,planningAttempt);assert.equal(state.planVersions.length,2);
  const revision=state.revision,changes=state.todoChanges.length;await s.call('dispatch_refine',args);assert.equal(state.executionInsights.length,1);assert.equal(state.revision,revision);assert.equal(state.todoChanges.length,changes);
  const checkpoint=await s.call('dispatch_checkpoint');assert.equal(checkpoint.originalUserPrompt,original);assert.equal(checkpoint.plan,state.conclusion);assert.equal(checkpoint.executionInsights.length,1);
  const before=JSON.stringify(state);await assert.rejects(s.call('dispatch_refine',{...args,understanding:'New',todos:[{text:'Valid',reason:'Valid'},{id:'missing',text:'Invalid',reason:'Invalid'}]}));assert.equal(JSON.stringify(state),before);
});
test('changed completed todo is reopened and old evidence invalidated by execution refinement',async()=>{
  const s=setup();await s.call('dispatch_todo',{text:'Old task',reason:'Initial',requirementIds:['initial'],status:'done',evidence:'Old output'});
  await s.call('dispatch_refine',{understanding:'Need expanded task',evidence:'Execution exposed wider coverage',impact:'Reopen changed work',requirementIds:['initial'],todos:[{id:'t1',text:'Expanded task',reason:'Actual finding'}]});const todo=s.runtime.states.get(s.agent).todos[0];assert.equal(todo.status,'pending');assert.equal(todo.evidence,undefined);
});
test('acceptance conclusion is tied to current delivery and enters a dedicated system section',async()=>{
  const s=setup({verifier:()=>({isError:false,content:[],value:{provider:'fixture',model:'fixture-judge',score:.2}})});mount(s.ctx,s.settings);
  s.events.get('agent/inbox/claimed')({agent:s.agent,turn:1,message:{source:{kind:'user'},content:[{type:'text',text:'Fixture original task'}]}});
  const call=(name,args)=>s.registered.find(t=>t.name===name).execute(args,s.exec);
  assert.equal((await call('dispatch_conclude',{completed:'Premature',implemented:'None',overallEffect:'Unknown',limitations:'None'})).status,'needs-current-acceptance');
  await call('dispatch_delivery',{summary:'Output',requirements:'Trace',constructionRequests:'Project and suite feedback',missingItems:'Missing coverage',problems:'Current issue',suiteStatus:'Fixture runtime only',suggestions:'Improve coverage'});
  await call('dispatch_conclude',{completed:'Actual fixture work',implemented:'Evidence export',overallEffect:'Low score; not accepted',limitations:'Remaining coverage'});
  let assembly=await s.events.get('system-prompt/assemble')({}, {agent:s.agent},async()=>({sections:[]}));const section=assembly.sections.find(s=>s.name==='orchestrator-suite:delivery-conclusion');assert.ok(section);assert.match(section.text,/Actual fixture work/);assert.match(section.text,/fixture-judge/);assert.match(section.text,/Missing coverage/);
  s.events.get('agent/inbox/claimed')({agent:s.agent,turn:2,message:{source:{kind:'user'},content:[{type:'text',text:'New requirement'}]}});
  assembly=await s.events.get('system-prompt/assemble')({}, {agent:s.agent},async()=>({sections:[]}));assert.equal(assembly.sections.some(s=>s.name==='orchestrator-suite:delivery-conclusion'),false);
});
test('board settings route only modifies the selected main task and never calls a judge',async()=>{
  let calls=0;const s=setup({verifier:()=>{calls++;return {isError:false,content:[]};}});mount(s.ctx,s.settings);s.events.get('agent/inbox/claimed')({agent:s.agent,turn:1,message:{source:{kind:'user'},content:[{type:'text',text:'Task'}]}});
  const route=s.routes.find(r=>r.path.endsWith('/verifier-route'));const request=body=>new Request('http://test/verifier-route',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await route.fetch(request({sessionId:'missing',settings:{planningRoute:'track',repeats:1}}))).status,404);
  assert.equal((await route.fetch(request({sessionId:s.agent.id,settings:{planningRoute:'track',repeats:9}}))).status,400);
  const result=await (await route.fetch(request({sessionId:s.agent.id,settings:{planningRoute:'select',repeats:1}}))).json();assert.equal(result.ok,true);assert.equal(result.settings.planningRoute,'select');assert.equal(calls,0);
});
test('public-tree privacy includes unlisted files and rejects local artifacts and links',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-public-'));try{await fs.writeFile(path.join(root,'README.md'),'Public source');await fs.writeFile(path.join(root,'unlisted.txt'),'Captured '+String.fromCharCode(67,58,92)+'local-private');const files=await publicFiles(root);assert.equal(files.length,2);const result=await scanFiles(root,files);assert.equal(result.findings.length,1);await fs.mkdir(path.join(root,'.validation'));await assert.rejects(publicFiles(root),/Local-only/);}finally{await fs.rm(root,{recursive:true,force:true});}
});
