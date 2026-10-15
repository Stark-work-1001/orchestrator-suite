import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';
import { root, dependency } from '../scripts/toolchain.mjs';
const requireToolchain = createRequire(dependency('react/package.json'));
const React = requireToolchain('react');
const requireHost = createRequire(path.join(root, 'package.json'));
const { JSDOM } = requireHost('jsdom');
const { createRoot } = requireHost('react-dom/client');
const { act } = React;
test('built client registers only compact header and board; close paths work', async () => {
  const dom = new JSDOM('<html><head></head><body><div id="test"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const stages = ['input', 'triage', 'compare', 'verify', 'assemble', 'supplement', 'todo', 'execute', 'trace', 'accept', 'construction'];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, sessionId: 'session', preset: 'dispatch-orchestrator', pollMs: 30000, task: { sessionId: 'session', prompt: 'task', progress: { current: 'execute', steps: stages.map(id => ({ id, status: id === 'execute' ? 'active' : 'pending' })) } } }) });
  let client;
  dom.window.__ModuleLoader__ = { load: d => { client = d.factory(requireToolchain); } };
  const source = await fs.readFile(path.join(root, 'lib/client.js'), 'utf8');
  vm.runInThisContext(source);
  const slots = [], cleanup = [], locale = JSON.parse(await fs.readFile(path.join(root, 'locale/zh.json'), 'utf8'));
  const t = key => locale[key] ?? key;
  client.apply({ effect: fn => { const result = fn(); if (typeof result === 'function') cleanup.push(result); }, locale: { register: () => () => {}, bind: () => t }, slots: { inject: (_key, fn) => fn(), register: (descriptor, render) => { slots.push({ descriptor, render }); return () => {}; } } });
  assert.deepEqual(client.inject, ['slots', 'locale']);
  assert.equal(slots.some(s => s.descriptor.name === 'sidebar.right.pane.tab'), false);
  const status = slots.find(s => s.descriptor.name === 'conversation.session.header.actions');
  const mount = createRoot(dom.window.document.getElementById('test'));
  try {
    await act(async () => { mount.render(status.render({ sessionId: 'session', t })); });
    const button = document.querySelector('.os-status-trigger');
    assert.match(button.textContent, /执行任务/);
    await act(async () => button.click()); assert.ok(document.querySelector('[role="dialog"]'));
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))); assert.equal(document.querySelector('[role="dialog"]'), null);
    await act(async () => button.click());
    await act(async () => document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))); assert.equal(document.querySelector('[role="dialog"]'), null);
    await act(async () => button.click());
    await act(async () => document.querySelector('.os-status-popover header button').click()); assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.ok(document.querySelector('.os-surface style').textContent.includes('--dsw-alias'));
  } finally {
    await act(async () => mount.unmount()); cleanup.forEach(fn => fn()); dom.window.close();
    for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; }
  }
});

test('board preserves old navigation and inserts verification, memory categories and public capability rows', async () => {
  const dom = new JSDOM('<html><head></head><body><div id="board"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const asset = (id, kind = 'plugin') => ({ id, name: id, kind, description: 'public metadata', status: 'available' });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, catalog: { generatedAt: new Date().toISOString(), skills: [], plugins: [], mcp: [], environments: [], tools: [], memoryRoots: [], warnings: [], memory: [asset('memory-system', 'memory-system'), asset('database-query', 'memory-database'), asset('memory.md', 'memory-file')], identity: [asset('dsh-cosplay')], organization: [asset('dsh-agent-swarm')], verification: [asset('verifier_compare', 'verifier-tool'), asset('verifier_current_session', 'verifier-tool')] }, tasks: [], sessions: [] }) });
  let client; dom.window.__ModuleLoader__ = { load: descriptor => { client = descriptor.factory(requireToolchain); } };
  vm.runInThisContext(await fs.readFile(path.join(root, 'lib/client.js'), 'utf8'));
  const slots = [], cleanup = [], locale = JSON.parse(await fs.readFile(path.join(root, 'locale/zh.json'), 'utf8'));
  const t = key => locale[key] ?? key;
  client.apply({ effect: fn => { const result = fn(); if (typeof result === 'function') cleanup.push(result); }, locale: { register: () => () => {}, bind: () => t }, slots: { inject: (_key, fn) => fn(), register: (descriptor, render) => { slots.push({ descriptor, render }); return () => {}; } } });
  const mount = createRoot(document.getElementById('board'));
  try {
    const entry = slots.find(row => row.descriptor.name === 'sidebar.footer.action');
    const overlay = slots.find(row => row.descriptor.name === 'shell.overlay');
    await act(async () => mount.render(React.createElement(React.Fragment, null, entry.render({ wide: true }), overlay.render())));
    await act(async () => document.querySelector('.os-entry').click());
    const nav = [...document.querySelectorAll('.os-nav button')];
    assert.equal(nav.length, 7); assert.match(nav[4].textContent, /团队协作/); assert.match(nav[5].textContent, /验证层/); assert.match(nav[6].textContent, /调度编排模式/);
    await act(async () => nav[5].click());
    assert.match(document.querySelector('.os-main').textContent, /verifier_compare/); assert.match(document.querySelector('.os-main').textContent, /verifier_current_session/);
    await act(async () => nav[2].click());
    const categories = [...document.querySelectorAll('.os-pills button')];
    assert.ok(categories.some(button => button.textContent.includes('记忆数据库')));
    assert.ok(categories.some(button => button.textContent.includes('记忆文件')));
    await act(async () => categories.find(button => button.textContent.includes('记忆数据库')).click()); assert.match(document.querySelector('.os-assets').textContent, /database-query/);
    await act(async () => nav[3].click()); assert.match(document.querySelector('.os-assets').textContent, /dsh-cosplay/);
    await act(async () => nav[4].click()); assert.match(document.querySelector('.os-main').textContent, /dsh-agent-swarm/); assert.match(document.querySelector('.os-main').textContent, /L0/); assert.match(document.querySelector('.os-main').textContent, /动态联系/);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); // Keyboard close is also covered by native panel listener below.
    await act(async () => document.querySelector('.os-panel').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('.os-panel'), null);
  } finally {
    await act(async () => mount.unmount()); cleanup.forEach(fn => fn());
    assert.equal(document.getElementById('orchestrator-suite:style'), null);
    dom.window.close();
    for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; }
  }
});

async function withUI(response, run) {
  const dom = new JSDOM('<html><head></head><body><div id="fixture"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (...args) => ({ ok: true, json: async () => response(...args) });
  let client; dom.window.__ModuleLoader__ = { load: descriptor => { client = descriptor.factory(requireToolchain); } };
  vm.runInThisContext(await fs.readFile(path.join(root, 'lib/client.js'), 'utf8'));
  const slots = [], cleanup = [], locale = JSON.parse(await fs.readFile(path.join(root, 'locale/zh.json'), 'utf8'));
  const t = key => locale[key] ?? key;
  client.apply({ effect: fn => { const result = fn(); if (typeof result === 'function') cleanup.push(result); }, locale: { register: () => () => {}, bind: () => t }, slots: { inject: (_key, fn) => fn(), register: (descriptor, render) => { slots.push({ descriptor, render }); return () => {}; } } });
  const mount = createRoot(document.getElementById('fixture'));
  try { await run({ dom, mount, slots, t }); }
  finally { await act(async () => mount.unmount()); cleanup.forEach(fn => fn()); dom.window.close(); for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; } }
}

test('ordinary preset shows only recorded layer result, even after switching from dispatch', async () => {
  const steps = ['input','triage','compare','verify','assemble','supplement','todo','execute','trace','accept','construction'].map(id => ({ id, status: 'pending' }));
  let preset = 'dispatch-orchestrator';
  const task = { sessionId: 'session', prompt: 'Task', layerSummary: 'Tools and teams remain available; identity unknown.', progress: { current: 'triage', steps } };
  await withUI(() => ({ ok: true, sessionId: 'session', preset, pollMs: 30000, task }), async ({ dom, mount, slots, t }) => {
    const slot = slots.find(row => row.descriptor.name === 'conversation.session.header.actions');
    await act(async () => mount.render(slot.render({ sessionId: 'session', t })));
    await act(async () => document.querySelector('.os-status-trigger').click());
    assert.equal(document.querySelectorAll('[data-stage]').length, 11);
    preset = 'standard';
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.equal(document.querySelector('.os-status-trigger').textContent, '已经编排');
    assert.equal(document.querySelectorAll('[data-stage]').length, 0);
    assert.equal(document.querySelectorAll('.os-status-position').length, 0);
    assert.match(document.querySelector('.os-layer-result').textContent, /Tools and teams/);
  });
});

test('disposing one slot leaves another slot’s stylesheet intact across repeated mounts', async () => {
  await withUI(() => ({}), async ({ mount, slots }) => {
    const entry = slots.find(row => row.descriptor.name === 'sidebar.footer.action');
    for (let count = 0; count < 12; count++) {
      await act(async () => mount.render(React.createElement(React.Fragment, null,
        React.createElement('div', { key: 'stable', id: 'stable' }, entry.render({ wide: true })),
        count % 2 ? null : React.createElement('div', { key: 'transient' }, entry.render({ wide: false })))));
      assert.match(document.querySelector('#stable style').textContent, /appearance:none/);
      assert.equal(document.querySelector('head #orchestrator-suite\\:style'), null);
    }
  });
});
test('three phases with unified rows retain lamps, state text, matching evidence and expansion during refresh', async () => {
  const stages = ['input', 'triage', 'compare', 'verify', 'assemble', 'supplement', 'todo', 'execute', 'trace', 'accept', 'construction'];
  let updated = false;
  const task = { sessionId: 'session', turn: 1, prompt: 'Original prompt with exact\nnewlines', triage: 'L1 scope', comparison: 'Actual layer judgments', conclusion: 'Integrated execution conclusion', review: '', acceptance: '{"score":0.7}', progress: { current: 'accept', error: 'Global last error', steps: stages.map(id => ({ id, status: id === 'verify' || id === 'compare' ? 'degraded' : id === 'execute' ? 'ended' : 'done', note: id === 'verify' ? 'Judge unavailable' : id === 'compare' ? 'Registry offline' : undefined, startedAt: '2026-10-13T00:00:00Z' })) } };
  await withUI(() => ({ ok: true, sessionId: 'session', preset: 'dispatch-orchestrator', pollMs: 30000, task: updated ? { ...task, triage: 'Updated triage' } : task }), async ({ dom, mount, slots, t }) => {
    const status = slots.find(slot => slot.descriptor.name === 'conversation.session.header.actions');
    await act(async () => mount.render(status.render({ sessionId: 'session', t })));
    await act(async () => document.querySelector('.os-status-trigger').click());
    const rows = [...document.querySelectorAll('.os-stage-row')];
    assert.equal(rows.length, 11); assert.equal(document.querySelector('.os-status-stages'), null);
    for (const row of rows) {
      assert.equal(row.open, false); assert.ok(row.querySelector('summary .os-status-light')); assert.ok(row.querySelector('summary .os-stage-state').textContent);
    }
    const verify = document.querySelector('[data-stage="verify"]');
    await act(async () => { verify.querySelector('summary').click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(verify.open, true); assert.match(verify.textContent, /Judge unavailable/); assert.doesNotMatch(verify.textContent, /Registry offline|Global last error/);
    const input = document.querySelector('[data-stage="input"]');
    await act(async () => { input.querySelector('summary').click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(input.querySelector('pre').textContent, task.prompt);
    assert.match(document.querySelector('[data-stage="assemble"] pre').textContent, /Integrated execution conclusion/);
    assert.match(document.querySelector('[data-stage="execute"]').textContent, /不等于任务完成/);
    updated = true;
    await act(async () => document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.equal(document.querySelector('[data-stage="verify"]').open, true);
    assert.match(document.querySelector('[data-stage="triage"]').textContent, /Updated triage/);
    await act(async () => mount.render(status.render({ sessionId: 'other', t })));
    assert.equal(document.querySelector('.os-status-popover'), null);
  });
});
test('board asset counts describe visible standalone rows and scope changes select the matching task', async () => {
  const row = (id, kind, ownerId) => ({ id, name: id, kind, ownerId, description: '', status: 'available' });
  const steps = ['input', 'triage', 'compare', 'verify', 'assemble', 'supplement', 'todo', 'execute', 'trace', 'accept', 'construction'].map(id => ({ id, status: 'pending' }));
  const tasks = ['A', 'B'].map(id => ({ sessionId: id, turn: 1, prompt: `${id} prompt`, triage: `${id} triage`, comparison: '', review: '', conclusion: '', progress: { current: 'triage', steps } }));
  await withUI((_url, options) => ({ ok: true, catalog: { generatedAt: new Date().toISOString(), skills: [row('owned', 'skill', 'plugin'), row('standalone', 'skill')], plugins: [{ ...row('plugin', 'plugin'), children: [row('owned', 'skill', 'plugin')] }], mcp: [], environments: [], tools: [], memory: [], memoryRoots: [], warnings: [], identity: [], organization: [], verification: [] }, tasks, sessions: tasks.map(task => ({ id: task.sessionId, preset: 'dispatch-orchestrator' })) }), async ({ dom, mount, slots }) => {
    await act(async () => mount.render(React.createElement(React.Fragment, null, slots.find(slot => slot.descriptor.name === 'sidebar.footer.action').render({ wide: true }), slots.find(slot => slot.descriptor.name === 'shell.overlay').render())));
    await act(async () => document.querySelector('.os-entry').click());
    const nav = [...document.querySelectorAll('.os-nav button')];
    await act(async () => nav[1].click());
    const skills = [...document.querySelectorAll('.os-pills button')].find(button => button.textContent.includes('技能'));
    await act(async () => skills.click()); assert.equal(skills.querySelector('span').textContent, '1');
    assert.match(document.querySelector('.os-assets').textContent, /standalone/); assert.doesNotMatch(document.querySelector('.os-assets').textContent, /owned/);
    await act(async () => nav[6].click());
    const selection = document.querySelector('#os-session');
    await act(async () => { selection.value = 'A'; selection.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelector('#os-scope').value, 'A'); assert.match(document.querySelector('.os-task').textContent, /A triage/);
    await act(async () => { const scope = document.querySelector('#os-scope'); scope.value = 'B'; scope.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelector('#os-session').value, 'B'); assert.match(document.querySelector('.os-task').textContent, /B triage/); assert.doesNotMatch(document.querySelector('.os-task').textContent, /A triage/);
  });
});

test('a superseded board response cannot overwrite the selected session snapshot', async () => {
  const steps = ['input', 'triage', 'compare', 'verify', 'assemble', 'supplement', 'todo', 'execute', 'trace', 'accept', 'construction'].map(id => ({ id, status: 'pending' }));
  const payload = id => ({ ok: true, catalog: { generatedAt: new Date().toISOString(), skills: [], plugins: [], mcp: [], environments: [], tools: [], memory: [], memoryRoots: [], warnings: [] }, tasks: id ? [{ sessionId: id, turn: 1, prompt: `${id} prompt`, triage: `${id} triage`, comparison: '', review: '', conclusion: '', progress: { current: 'triage', steps } }] : [], sessions: [{ id: 'A', preset: 'dispatch-orchestrator' }, { id: 'B', preset: 'dispatch-orchestrator' }] });
  let releaseOld;
  await withUI((_url, options) => {
    const id = JSON.parse(options.body).sessionId;
    return id === 'A' ? new Promise(resolve => { releaseOld = () => resolve(payload('A')); }) : payload(id);
  }, async ({ dom, mount, slots }) => {
    await act(async () => mount.render(React.createElement(React.Fragment, null, slots.find(slot => slot.descriptor.name === 'sidebar.footer.action').render({ wide: true }), slots.find(slot => slot.descriptor.name === 'shell.overlay').render())));
    await act(async () => document.querySelector('.os-entry').click());
    await act(async () => [...document.querySelectorAll('.os-nav button')][6].click());
    await act(async () => { const scope = document.querySelector('#os-scope'); scope.value = 'A'; scope.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await act(async () => { const scope = document.querySelector('#os-scope'); scope.value = 'B'; scope.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('.os-task').textContent, /B triage/);
    await act(async () => releaseOld());
    assert.equal(document.querySelector('#os-scope').value, 'B'); assert.match(document.querySelector('.os-task').textContent, /B triage/);
  });
});

test('three-phase status shows identities, requirements, todo history and exports unchanged full prompts', async () => {
  const stages = ['input', 'triage', 'compare', 'verify', 'assemble', 'supplement', 'todo', 'execute', 'trace', 'accept', 'construction'];
  const task = { sessionId: 'session', taskId: 'fixture-task', turn: 2, revision: 3, prompt: 'Original exact\n\nprompt', triage: 'Triage', comparison: '', review: '', conclusion: 'Plan', guidance: 'full', planVersions: [{ version: 1, plan: 'Plan' }], supplements: [{ id: 'r1', prompt: 'Supplement exact\n\ntext', status: 'assessed', understanding: 'Keep export', impact: 'One todo', todoIds: ['t1'], turn: 2 }], todos: [{ id: 't1', text: 'Export output', status: 'done', requirementIds: ['r1'], reason: 'New requirement', evidence: 'Export checked' }], todoChanges: [{ todoId: 't1', after: { status: 'done' } }], reports: [{ stage: 'trace', summary: 'Trace full scope', source: 'Actual results' }], identities: [{ phase: 'planning', stage: 'triage', identity: 'Planner', mode: 'static', scale: 'L1', reason: 'Stable', evidence: 'Scope' }, { phase: 'delivery', stage: 'trace', identity: 'Acceptance lead', mode: 'dynamic', scale: 'L2', reason: 'Phase changed', evidence: 'Results' }], delivery: { revision: 3, summary: 'Delivered', requirements: 'All linked', constructionRequests: 'Future enhancement' }, progress: { current: 'trace', steps: stages.map(id => ({ id, status: 'done' })) } };
  await withUI(() => ({ ok: true, sessionId: 'session', preset: 'dispatch-orchestrator', pollMs: 30000, task }), async ({ mount, slots, t }) => {
    await act(async () => mount.render(slots.find(s => s.descriptor.name === 'conversation.session.header.actions').render({ sessionId: 'session', t })));
    assert.equal(document.querySelector('.os-status-position').textContent, '3/3');
    assert.equal(document.querySelectorAll('.os-status-dots i').length, 3);
    await act(async () => document.querySelector('.os-status-trigger').click());
    assert.equal(document.querySelectorAll('[data-phase]').length, 3);
    assert.match(document.querySelector('[data-phase="planning"] .os-phase-identity').textContent, /Planner/);
    assert.match(document.querySelector('[data-phase="delivery"] .os-phase-identity').textContent, /Acceptance lead/);
    assert.match(document.querySelector('[data-stage="trace"] .os-understanding').textContent, /Trace full scope/);
    assert.match(document.querySelector('.os-prompt-export').textContent, /Original exact/); assert.match(document.querySelector('.os-prompt-export').textContent, /Supplement exact/);
    assert.match(document.querySelector('[data-stage="todo"]').textContent, /Export checked/);
    const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL, oldClick = window.HTMLAnchorElement.prototype.click;
    let blob, downloaded;
    URL.createObjectURL = b => { blob = b; return 'blob:fixture'; }; URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
    try {
      await act(async () => document.querySelector('.os-export').click());
      assert.equal(downloaded, 'orchestrator-suite-3.0.3-delivery.json');
      const json = JSON.parse(await blob.text()); assert.equal(json.originalUserPrompt, task.prompt); assert.equal(json.processUserPrompts[0].prompt, task.supplements[0].prompt);
    } finally { URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; window.HTMLAnchorElement.prototype.click = oldClick; }
  });
});

test('todo assessment panel distinguishes unassessed emptiness, covered no-change and invocation failure', async () => {
  const stages = ['input','triage','compare','verify','assemble','supplement','todo','execute','trace','accept','construction'];
  const task = { sessionId:'session',taskId:'assess-fixture',turn:1,revision:1,prompt:'Prompt',triage:'',comparison:'',review:'',conclusion:'',reports:[],supplements:[],todos:[],todoChanges:[],todoAssessments:[],planVersions:[],identities:[],judgeAttempts:[],progress:{current:'todo',steps:stages.map(id=>({id,status:id==='todo'?'active':'pending'}))} };
  await withUI(()=>({ok:true,version:'3.0.3',sessionId:'session',preset:'dispatch-orchestrator',pollMs:30000,task}),async ({dom,mount,slots,t})=>{
    await act(async()=>mount.render(slots.find(s=>s.descriptor.name==='conversation.session.header.actions').render({sessionId:'session',t})));
    await act(async()=>document.querySelector('.os-status-trigger').click());
    assert.match(document.querySelector('[data-stage="todo"] .os-stage-state').textContent,/尚未完整评估/);
    assert.match(document.querySelector('[data-stage="todo"]').textContent,/没有变更不能说明已经评估/);
    task.todoAssessments.push({requirementIds:['initial'],understanding:'已检查当前计划',decision:'covered',reason:'已有规划覆盖，不新增事项',todoIds:[],planVersion:1});
    task.progress.steps.find(s=>s.id==='todo').status='assessed';
    task.acceptanceAttempt={id:'attempt-fixture',stage:'accept',tool:'verifier_current_session',outcome:'failed',toolInvoked:true,revision:1,startedAt:'2026-10-14T00:00:00Z',finishedAt:'2026-10-14T00:00:01Z',error:'Actual judge request failure'};
    task.progress.steps.find(s=>s.id==='accept').status='degraded';
    await act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));
    assert.match(document.querySelector('[data-stage="todo"] .os-stage-state').textContent,/已评估 · 无变更/);
    assert.match(document.querySelector('.os-todo-assessments').textContent,/已有规划覆盖，不新增事项/);
    assert.match(document.querySelector('[data-stage="accept"]').textContent,/Actual judge request failure/);
    assert.match(document.querySelector('[data-stage="accept"]').textContent,/已向公共验证工具发出实际调用/);
    assert.match(document.querySelector('[data-stage="accept"] .os-understanding').textContent,/尚未提交理解/);
    assert.doesNotMatch(document.querySelector('.os-runtime-version').textContent,/尚未确认/);
  });
});

test('verifier panel saves only task route and displays returned models and evaluation', async()=>{
  const posts=[];const task={sessionId:'session',prompt:'Fixture task',verifierSettings:{planningRoute:'auto',repeats:1},judgeAttempts:[],planningAttempt:{tool:'verifier_select',outcome:'evaluated',toolInvoked:true,provider:'fixture-provider',model:'fixture-judge',routeReason:'Three real candidates',evaluation:{scores:[.2,.3,.5]}},acceptanceAttempt:{tool:'verifier_current_session',outcome:'failed',toolInvoked:true,error:'Fixture verification failure'}};
  const catalog={generatedAt:new Date().toISOString(),skills:[],plugins:[],mcp:[],environments:[],tools:[],memory:[],memoryRoots:[],warnings:[],identity:[],organization:[],verification:[]};
  await withUI((url,options)=>{if(url.endsWith('/verifier-route')){posts.push(JSON.parse(options.body));return {ok:true,settings:posts.at(-1).settings};}return {ok:true,catalog,tasks:[task],sessions:[{id:'session',preset:'dispatch-orchestrator'}]};},async({dom,mount,slots})=>{
    await act(async()=>mount.render(React.createElement(React.Fragment,null,...slots.filter(s=>s.descriptor.name!=='conversation.session.header.actions').map((s,i)=>React.createElement(React.Fragment,{key:i},s.render({wide:true}))))));
    await act(async()=>document.querySelector('.os-entry').click());
    await act(async()=>{const scope=document.querySelector('#os-scope');scope.value='session';scope.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
    await act(async()=>[...document.querySelectorAll('.os-nav button')].find(b=>b.textContent.includes('验证层')).click());
    assert.match(document.querySelector('.os-verifier-panel').textContent,/fixture-provider \/ fixture-judge/);assert.match(document.querySelector('.os-verifier-panel').textContent,/Fixture verification failure/);
    await act(async()=>{const select=document.querySelector('[aria-label="规划验证路由"]');select.value='track';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
    await act(async()=>[...document.querySelectorAll('.os-verifier-controls button')][0].click());assert.deepEqual(posts,[{sessionId:'session',settings:{planningRoute:'track',repeats:1}}]);assert.match(document.querySelector('.os-verifier-panel').textContent,/不立即调用裁判/);
  });
});
