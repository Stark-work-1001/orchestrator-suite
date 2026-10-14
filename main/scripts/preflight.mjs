/** Read-only composed-profile checks in a suite-owned temporary DSH_HOME. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { root } from './toolchain.mjs';
import { scrub } from './privacy-scan.mjs';

// No machine-specific defaults: a release must not carry one workstation's
// layout. Both values must be supplied explicitly or the check is skipped.
const profile = process.env.ORCHESTRATOR_PROFILE;
const cli = process.env.ORCHESTRATOR_DSH_CLI;
const baseline = process.argv.includes('--baseline');
const suiteRoot = baseline ? path.join(root, 'archive', '2.2.0') : root;
const pkg = JSON.parse(await fs.readFile(path.join(suiteRoot, 'package.json'), 'utf8'));
const reportPath = path.join(root, baseline ? 'docs/preflight-baseline.json' : 'docs/preflight.json');

async function unavailable(reason) {
  const report = {
    date: new Date().toISOString(), version: pkg.version, status: 'skipped', reason,
    required: { ORCHESTRATOR_PROFILE: profile ?? null, ORCHESTRATOR_DSH_CLI: cli ?? null },
    note: 'Composition only; no live apply, no browser, no model calls. A skipped run is not a pass.',
  };
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (!profile) await unavailable('ORCHESTRATOR_PROFILE is not set');
if (!cli) await unavailable('ORCHESTRATOR_DSH_CLI is not set');
if (!await fs.stat(profile).then(s => s.isDirectory()).catch(() => false)) await unavailable(`ORCHESTRATOR_PROFILE is not a readable directory: ${profile}`);
if (!await fs.stat(cli).then(s => s.isFile()).catch(() => false)) await unavailable(`ORCHESTRATOR_DSH_CLI is not a readable file: ${cli}`);

await fs.mkdir(path.join(root, '.validation'), { recursive: true });
const stagingHome = await fs.mkdtemp(path.join(root, '.validation', 'dsh-home-'));
const profileName = baseline ? 'suite-preflight-baseline' : 'suite-preflight';
const stage = path.join(stagingHome, 'profiles', profileName);
await fs.mkdir(stage, { recursive: true });
for (const file of ['package.json', 'cordis.yml', 'cordis.patch.yml']) await fs.copyFile(path.join(profile, file), path.join(stage, file));
const modules = path.join(stage, 'node_modules');
{
  await fs.mkdir(modules, { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(profile, 'package.json'), 'utf8'));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const link = path.join(modules, name); await fs.mkdir(path.dirname(link), { recursive: true });
    try { await fs.lstat(link); } catch { await fs.symlink(name === pkg.name ? suiteRoot : path.join(profile, 'node_modules', name), link, 'junction'); }
  }
}
const run = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', cli, '--profile', profileName, '--dump-config'], { env: { ...process.env, DSH_HOME: stagingHome }, encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
const text = run.stdout ?? '';
const resolvedHost = createRequire(path.join(stage, 'package.json')).resolve(pkg.name);
const expectedHost = path.resolve(suiteRoot, pkg.main);
const newHost = resolvedHost.toLowerCase() === expectedHost.toLowerCase() && text.includes('name: orchestrator-suite');
const newPreset = text.includes('调度编排模式'), advisoryPolicy = text.includes('不强制') && text.includes('综合装配规划');
const valid = run.status === 0 && newHost && newPreset && advisoryPolicy;
const report = {
  date: new Date().toISOString(), version: pkg.version, status: valid ? 'pass' : 'fail', exitCode: run.status,
  composedBytes: Buffer.byteLength(text), configHash: createHash('sha256').update(text).digest('hex'),
  newHost, resolvedHost: scrub(resolvedHost), newPreset, advisoryPolicy,
  // Tool output can embed absolute staging paths and credentials; scrub before it
  // is written into a report that ships inside the release archive.
  errors: scrub(run.stderr ?? '').trim(),
  note: 'Composition only; no live apply, no browser, no model calls.',
};
await fs.mkdir(path.join(root, 'docs'), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!valid) process.exit(1);
