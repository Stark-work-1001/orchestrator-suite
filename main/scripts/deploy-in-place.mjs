/** Only update an explicitly selected, already registered suite; no host/profile writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './toolchain.mjs';
import { packagedFiles } from './privacy-scan.mjs';

if (!process.env.ORCHESTRATOR_INSTALL_DIR || !process.env.ORCHESTRATOR_PROFILE) throw new Error('Explicit ORCHESTRATOR_INSTALL_DIR and ORCHESTRATOR_PROFILE required');
const target = await fs.realpath(path.resolve(process.env.ORCHESTRATOR_INSTALL_DIR));
const profile = await fs.realpath(path.resolve(process.env.ORCHESTRATOR_PROFILE));
const source = await fs.realpath(root);
if (target === source || path.parse(target).root === target || source.startsWith(target + path.sep)) throw new Error('Unsafe installation target');
const pkg = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
const installed = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(profile, 'package.json'), 'utf8'));
if (installed.name !== pkg.name || !manifest.dsh?.profile?.bundles?.includes(pkg.name) || !manifest.dependencies?.[pkg.name]?.startsWith('link:')) throw new Error('Expected existing link bundle registration');
if ((await fs.realpath(path.join(profile, 'node_modules', pkg.name))).toLowerCase() !== target.toLowerCase()) throw new Error('Registered bundle resolves to another directory');
const verification = JSON.parse(await fs.readFile(path.join(source, 'docs/verification.json'), 'utf8'));
const preflight = JSON.parse(await fs.readFile(path.join(source, 'docs/preflight.json'), 'utf8'));
if (!verification.ok || verification.version !== pkg.version || preflight.version !== pkg.version || preflight.status !== 'pass' || !preflight.newHost || !preflight.newPreset || !preflight.advisoryPolicy) throw new Error('Current-version verification and real profile composition must pass');
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const protectedProfileFiles = ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-lock.yaml'];
async function protectedHashes() {
  const result = {};
  for (const relative of protectedProfileFiles) { const file = path.join(profile, relative); result[file] = await hash(file); }
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || ['node_modules', '.git', '.venv', 'venv', '.validation', 'archive', '.work', '.cache'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|json|yml|yaml|md|css|map)$/iu.test(entry.name)) result[file] = await hash(file);
    }
  }
  for (const entry of await fs.readdir(path.dirname(target), { withFileTypes: true })) if (entry.isDirectory() && entry.name !== path.basename(target)) await visit(path.join(path.dirname(target), entry.name));
  return result;
}
const before = await protectedHashes();
const configHash = await hash(path.join(target, 'suite.config.json'));
const archiveDir = path.join(target, 'archive');
const archiveStat = await fs.lstat(archiveDir).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
if (archiveStat?.isSymbolicLink()) throw new Error('Refusing a redirected backup directory');
const backup = path.join(target, 'archive', `before-${pkg.version}-${Date.now()}`);
await fs.mkdir(backup, { recursive: true });
const files = (await packagedFiles(source)).filter(file => file !== 'suite.config.json');
const changed = [];
try {
  for (const relative of files) {
    const from = path.join(source, relative), to = path.resolve(target, relative);
    if (!to.startsWith(target + path.sep)) throw new Error('File escaped installation target');
    // Resolve parents to reject an installed symlink redirecting a write outside the suite.
    let parent = path.dirname(to);
    while (!await fs.stat(parent).catch(() => null)) parent = path.dirname(parent);
    const realParent = await fs.realpath(parent);
    if (realParent !== target && !realParent.startsWith(target + path.sep)) throw new Error('Installed parent escapes suite: ' + relative);
    const existing = await fs.lstat(to).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing?.isSymbolicLink()) throw new Error('Refusing to overwrite installed symlink: ' + relative);
    if (existing && await hash(from) === await hash(to)) continue;
    if (existing) { const saved = path.join(backup, relative); await fs.mkdir(path.dirname(saved), { recursive: true }); await fs.copyFile(to, saved); }
    changed.push({ path: relative, existed: !!existing });
    await fs.mkdir(path.dirname(to), { recursive: true }); await fs.copyFile(from, to);
    if (await hash(to) !== await hash(from)) throw new Error('Installed file hash mismatch: ' + relative);
  }
  const after = await protectedHashes();
  const drift = Object.keys(before).filter(file => before[file] !== after[file]);
  if (drift.length || await hash(path.join(target, 'suite.config.json')) !== configHash) throw new Error('Protected file drift; local configuration and external files must remain unchanged');
  await fs.writeFile(path.join(backup, 'ROLLBACK-MANIFEST.json'), JSON.stringify({ version: pkg.version, previousVersion: installed.version, files: changed }, null, 2) + '\n');
  const report = { version: pkg.version, previousVersion: installed.version, target, backup, copiedFiles: changed.length, checkedExternalFiles: Object.keys(before).length, profileUnchanged: true, otherExistingPluginSourcesUnchanged: true, localConfigurationUnchanged: true, removedFiles: 0, application: 'disk-only; live activation not verified', paidJudgeCalls: 0 };
  await fs.writeFile(path.join(source, 'docs/installation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  for (const change of changed.reverse()) {
    const to = path.resolve(target, change.path);
    if (!to.startsWith(target + path.sep)) throw new Error('Rollback escaped installation target');
    if (change.existed) await fs.copyFile(path.join(backup, change.path), to); else await fs.unlink(to).catch(() => {});
  }
  throw error;
}
