/** Read-only discovery through Host registries and explicitly configured memory roots. */
import { readdir, stat, open, realpath, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import type { Catalog, Asset } from '../shared';
import { toolAssets, type Context, type Agent } from './types';
import { layerCatalog } from './layers';
export interface Config {
  memoryRoots: string[]; assetRoots: string[]; memoryDepth: number; memoryFileLimit: number; memoryReadBytes: number; catalogLimit: number;
  scanTimeoutMs: number; verifierTimeoutMs: number; recentSessionLimit: number; contextCatalogLimit: number; contextDescriptionChars: number; relicEnabled: boolean; verifierTool: string; progressPollMs: number;
  planningMinChars: number; planningMinParagraphs: number; planningParagraphMinChars: number;
}
export function parseConfig(raw: unknown): Config {
  if (!raw || typeof raw !== 'object') throw new Error('suite.config.json must contain an object');
  const value = raw as Record<string, unknown>;
  const thresholds = { planningMinChars: value.planningMinChars ?? 600, planningMinParagraphs: value.planningMinParagraphs ?? 4, planningParagraphMinChars: value.planningParagraphMinChars ?? 120 };
  for (const [key, threshold] of Object.entries(thresholds)) if (!Number.isSafeInteger(threshold) || Number(threshold) < 1 || Number(threshold) > 100000) throw new Error(`Invalid ${key}`);
  const progressPollMs = value.progressPollMs ?? 1500;
  if (!Number.isSafeInteger(progressPollMs) || Number(progressPollMs) < 500 || Number(progressPollMs) > 30000) throw new Error('Invalid progressPollMs');
  if (!Array.isArray(value.memoryRoots) || value.memoryRoots.some(p => typeof p !== 'string' || !p.trim())) throw new Error('memoryRoots must be paths');
  const assetRoots = value.assetRoots ?? [];
  if (!Array.isArray(assetRoots) || assetRoots.some(p => typeof p !== 'string' || !p.trim()) || assetRoots.length > 20) throw new Error('assetRoots must be at most 20 paths');
  for (const key of ['memoryDepth', 'memoryFileLimit', 'memoryReadBytes', 'catalogLimit', 'contextCatalogLimit', 'contextDescriptionChars', 'scanTimeoutMs', 'verifierTimeoutMs', 'recentSessionLimit']) {
    if (!Number.isSafeInteger(value[key]) || Number(value[key]) < 1) throw new Error(`Invalid configuration: ${key}`);
  }
  if (Number(value.memoryDepth) > 5 || Number(value.memoryFileLimit) > 1000 || Number(value.memoryReadBytes) > 65536 || Number(value.catalogLimit) > 2000) throw new Error('Discovery limits exceed supported bounds');
  if (typeof value.relicEnabled !== 'boolean' || value.verifierTool !== 'verifier_compare') throw new Error('Invalid relicEnabled or verifierTool');
  return {
    memoryRoots: value.memoryRoots as string[], assetRoots, memoryDepth: Number(value.memoryDepth), memoryFileLimit: Number(value.memoryFileLimit),
    memoryReadBytes: Number(value.memoryReadBytes), catalogLimit: Number(value.catalogLimit), scanTimeoutMs: Number(value.scanTimeoutMs),
    verifierTimeoutMs: Number(value.verifierTimeoutMs), recentSessionLimit: Number(value.recentSessionLimit), relicEnabled: value.relicEnabled,
    contextCatalogLimit: Number(value.contextCatalogLimit), contextDescriptionChars: Number(value.contextDescriptionChars),
    verifierTool: value.verifierTool, progressPollMs: Number(progressPollMs),
    planningMinChars: Number(thresholds.planningMinChars), planningMinParagraphs: Number(thresholds.planningMinParagraphs), planningParagraphMinChars: Number(thresholds.planningParagraphMinChars),
  };
}
export async function memoryCatalog(config: Config, signal: AbortSignal): Promise<{ assets: Asset[]; warnings: string[] }> {
  const assets: Asset[] = [], warnings: string[] = [];
  for (const rootPath of config.memoryRoots) {
    const root = resolve(rootPath);
    try {
      const canonical = await realpath(root);
      async function visit(dir: string, depth: number): Promise<void> {
        signal.throwIfAborted();
        if (assets.length >= config.memoryFileLimit) return;
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          signal.throwIfAborted();
          if (assets.length >= config.memoryFileLimit) break;
          if (entry.isSymbolicLink() || entry.name.startsWith('.') || /credential|secret|token|policy|password/i.test(entry.name)) continue;
          const path = join(dir, entry.name);
          if (entry.isDirectory() && depth < config.memoryDepth) await visit(path, depth + 1);
          else if (entry.isFile() && /\.md$/i.test(entry.name)) {
            assets.push({ id: path, name: relative(canonical, path), kind: 'memory-file', description: 'Markdown 记忆；内容尚未读取', status: 'discovered', path });
          }
        }
      }
      await visit(canonical, 0);
    } catch (error) {
      signal.throwIfAborted();
      warnings.push(`Memory root unavailable: ${root} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  if (assets.length >= config.memoryFileLimit) warnings.push('Memory catalog reached memoryFileLimit; it may be incomplete.');
  return { assets, warnings };
}
export async function readMemory(asset: Asset, config: Config, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  if (!asset.path) throw new Error('Memory record has no path');
  const path = await realpath(asset.path);
  const permitted = await Promise.all(config.memoryRoots.map(root => realpath(root).catch(() => '')));
  if (!permitted.some(root => root && !relative(root, path).startsWith('..') && !relative(root, path).includes(':'))) throw new Error('Memory path escaped configured roots');
  const file = await open(path, 'r');
  try {
    const metadata = await stat(path), bytes = Buffer.alloc(Math.min(metadata.size, config.memoryReadBytes));
    await file.read(bytes, 0, bytes.length, 0);
    signal.throwIfAborted();
    return bytes.toString('utf8') + (metadata.size > bytes.length ? '\n[truncated by memoryReadBytes]' : '');
  } finally { await file.close(); }
}
export async function resolveCwd(ctx: Context, agent: Agent, signal: AbortSignal): Promise<string | undefined> {
  signal.throwIfAborted();
  // Session header is public and does not require an optional, uninjected service.
  return typeof agent.session?.header?.cwd === 'string' ? agent.session.header.cwd : undefined;
}
export async function collectCatalog(ctx: Context, config: Config, signal: AbortSignal, agent?: Agent): Promise<Catalog> {
  const cwd = agent ? await resolveCwd(ctx, agent, signal) : undefined;
  const options = { scope: agent, signal, ...(cwd ? { cwd } : {}) };
  const bounded = <T>(promise: Promise<T>): Promise<T> => new Promise((resolvePromise, reject) => {
    const abort = () => reject(signal.reason ?? new Error('Discovery cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolvePromise, reject).finally(() => signal.removeEventListener('abort', abort));
  });
  const [skillResult, bundleResult, pluginResult, memoryResult] = await Promise.allSettled([
    bounded(ctx.skills.list(options)), bounded(ctx.pluginManager?.listBundles() ?? Promise.resolve([])),
    bounded(ctx.pluginManager?.listPlugins() ?? Promise.resolve([])), bounded(memoryCatalog(config, signal)),
  ]);
  signal.throwIfAborted();
  const warnings: string[] = [];
  const result = <T>(value: PromiseSettledResult<T>, fallback: T, layer: string): T => {
    if (value.status === 'fulfilled') return value.value;
    warnings.push(`${layer}: ${String(value.reason)}`); return fallback;
  };
  const skills: Asset[] = result(skillResult, [], 'Skills').map(s => ({ id: s.name, name: s.name, kind: 'skill', description: s.description, status: s.invocation.modelInvocable ? 'available' : 'disabled', ...(s.path ? { path: s.path } : {}) }));
  const bundles = result(bundleResult, [], 'Bundles');
  const plugins: Asset[] = bundles.map(b => ({ id: b.name, name: b.name, kind: 'bundle', description: b.description ?? '', status: b.error ? 'failed' : b.enabled ? 'enabled' : 'disabled' }));
  const runtime = [...result(pluginResult, [], 'Plugins')];
  if (agent) {
    const preset = ctx.agentPresets.composedPreset(agent.ctx);
    try {
      const composition = (await bounded(ctx.agentPresets.compositionInventory())).find(row => row.id === preset);
      if (composition) runtime.push(...composition.rows);
    } catch (error) { warnings.push(`Preset inventory: ${String(error)}`); }
  }
  for (const row of runtime) {
    const display = (text?: string | Record<string, string>): string => typeof text === 'string' ? text : text?.zh ?? text?.en ?? '';
    const title = display(row.meta?.title) || row.moduleName;
    const index = plugins.findIndex(p => p.id === row.moduleName);
    if (index >= 0 && plugins[index].kind === 'bundle' || plugins.some(p => p.kind === 'bundle' && p.name === title)) continue;
    const asset = { id: row.moduleName, name: title, kind: 'plugin', description: display(row.meta?.description) || `Host entry: ${row.entryId}`, status: row.enabled ? row.fiberPhase === 'active' ? 'enabled' : row.fiberPhase ?? 'unknown' : 'disabled' };
    if (index >= 0) plugins[index] = asset; else plugins.push(asset);
  }
  if (!ctx.pluginManager) warnings.push('Plugin registry not yet available; plugin and memory-system discovery is incomplete.');
  const tools = toolAssets(ctx, agent), servers = new Map<string, Asset>();
  for (const tool of tools) {
    const server = /^mcp__([^_].*?)__/.exec(tool.name)?.[1];
    if (server) servers.set(server, { id: server, name: server, kind: 'mcp', description: `已注册工具：${tools.filter(t => t.name.startsWith(`mcp__${server}__`)).length}`, status: 'available' });
  }
  for (const row of runtime.filter(row => row.moduleName.includes('mcp-client'))) {
    const owners = bundles.filter(bundle => bundle.rows?.some(declared => declared.entryId === row.entryId || declared.rowId === row.entryId.replace(/^include:/, '')));
    servers.set(row.entryId, { id: row.entryId, name: row.entryId, kind: 'mcp', description: `${row.moduleName}; runtime row, tool namespaces listed separately when visible`, status: row.enabled ? row.fiberPhase === 'active' ? 'unknown' : row.fiberPhase ?? 'unknown' : 'disabled', ...(owners.length === 1 ? { ownerId: owners[0].name, ownership: 'DSH bundle declared row' } : {}) });
  }
  const memory = result(memoryResult, { assets: [], warnings: [] }, 'Memory'); warnings.push(...memory.warnings);
  const cap = (rows: Asset[], layer: string): Asset[] => { if (rows.length > config.catalogLimit) warnings.push(`${layer} truncated by catalogLimit`); return rows.slice(0, config.catalogLimit); };
  const environments: Asset[] = [];
  // Explicit roots: inspect package manifests and environment markers, never private
  // plugin configuration, executables, credentials, or Python site-packages.
  const roots: Array<{ id: string; path: string }> = [];
  for (const root of config.assetRoots) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries.slice(0, config.catalogLimit)) {
        signal.throwIfAborted();
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const path = await realpath(join(root, entry.name)).catch(error => { warnings.push(`Asset path unavailable: ${entry.name} (${String(error)})`); return ''; });
        if (!path) continue;
        try {
          const manifestPath = join(path, 'package.json');
          if ((await stat(manifestPath)).size > 65536) continue;
          const manifest = JSON.parse(await readFile(manifestPath, { encoding: 'utf8', signal }));
          if (typeof manifest.name !== 'string' || !manifest.dsh) continue;
          let owner = plugins.find(p => p.id === manifest.name);
          if (!owner) { owner = { id: manifest.name, name: manifest.name, kind: manifest.dsh.bundle ? 'bundle' : 'plugin', description: typeof manifest.description === 'string' ? manifest.description : '', status: 'discovered', path }; plugins.push(owner); }
          owner.path = path;
          if (!roots.some(root => root.id === owner!.id && root.path.toLowerCase() === path.toLowerCase())) roots.push({ id: owner.id, path });
        } catch (error) {
          // Missing manifests are normal; malformed/denied reads are evidence gaps.
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnings.push(`Package metadata unavailable: ${path} (${String(error)})`);
        }
      }
    } catch (error) { signal.throwIfAborted(); warnings.push(`Asset root unavailable: ${root} (${String(error)})`); }
  }
  const inside = (root: string, path: string) => { const rel = relative(root, path); return rel === '' || (!rel.startsWith('..') && !rel.includes(':')); };
  for (const skill of skills) {
    if (!skill.path) continue;
    const path = await realpath(skill.path).catch(() => resolve(skill.path!));
    const owners = roots.filter(root => inside(root.path, path)).sort((a, b) => b.path.length - a.path.length);
    if (owners[0]) { skill.ownerId = owners[0].id; skill.ownership = 'canonical path containment'; }
  }
  let visited = 0;
  async function findEnvironments(dir: string, ownerId?: string, depth = 0): Promise<void> {
    signal.throwIfAborted();
    if (environments.length >= config.catalogLimit || ++visited > config.catalogLimit * 4) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    if (entries.some(entry => entry.isFile() && entry.name === 'pyvenv.cfg')) {
      environments.push({ id: dir, name: relative(ownerId ? roots.find(r => r.id === ownerId)!.path : cwd ?? dir, dir) || dir, kind: 'venv', description: 'pyvenv.cfg marker discovered; interpreter health not tested', status: 'discovered', path: dir, ...(ownerId ? { ownerId, ownership: 'canonical path containment' } : {}) }); return;
    }
    if (ownerId && entries.some(entry => entry.isFile() && entry.name === 'SKILL.md')) {
      const skillPath = join(dir, 'SKILL.md');
      const canonicalSkillPath = await realpath(skillPath).catch(() => skillPath);
      if (!(await Promise.all(skills.map(async skill => skill.path ? (await realpath(skill.path).catch(() => resolve(skill.path!))).toLowerCase() === canonicalSkillPath.toLowerCase() : false))).some(Boolean)) {
        skills.push({ id: skillPath, name: relative(roots.find(r => r.id === ownerId)!.path, dir), kind: 'skill', description: 'Packaged SKILL.md marker; not confirmed in the session skill registry', status: 'discovered', path: skillPath, ownerId, ownership: 'canonical path containment' });
      }
      // A skill folder may contain an environment; keep scanning within the bound.
    }
    if (depth >= 3) return;
    for (const entry of entries.slice(0, config.catalogLimit)) {
      if (!entry.isDirectory() || /^(node_modules|site-packages|\.git|lib|dist|build|__pycache__)$/i.test(entry.name)) continue;
      await findEnvironments(join(dir, entry.name), ownerId, depth + 1);
    }
  }
  for (const root of roots) await findEnvironments(root.path, root.id);
  // Standalone project environments use explicit well-known markers, not recursive
  // discovery of a whole workspace or third-party plugin contents.
  if (cwd) for (const name of ['.venv', 'venv', 'env']) await findEnvironments(join(cwd, name));
  if (visited > config.catalogLimit * 4) warnings.push('Environment discovery reached its directory budget; catalog may be incomplete.');
  const boundedPlugins = cap(plugins, 'Plugins'), boundedSkills = cap(skills, 'Skills'), mcp = cap([...servers.values()], 'MCP');
  for (const plugin of boundedPlugins) plugin.children = [...boundedSkills, ...mcp, ...environments].filter(asset => asset.ownerId === plugin.id);
  const layers = layerCatalog(boundedPlugins, tools);
  return { generatedAt: new Date().toISOString(), scope: agent?.id ?? 'host', skills: boundedSkills, plugins: boundedPlugins, mcp, environments, memory: cap([...layers.memory, ...memory.assets], 'Memory'), identity: cap(layers.identity, 'Identity'), organization: cap(layers.organization, 'Organization'), verification: layers.verification, tools: cap(tools, 'Tools'), warnings, memoryRoots: config.memoryRoots };
}
