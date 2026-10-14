/** Update only this registered bundle link; source/profile hashes are checked. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './toolchain.mjs';
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
// A release must not carry one workstation's profile location, so there is no
// default: the caller states which profile this suite is linked into.
if (!process.env.ORCHESTRATOR_PROFILE) { console.error('ORCHESTRATOR_PROFILE is not set; refusing to guess a profile directory.'); process.exit(1); }
const profile = path.resolve(process.env.ORCHESTRATOR_PROFILE);
const link = path.join(profile, 'node_modules', pkg.name), target = await fs.realpath(root);
const baselineFile = path.join(root, 'docs', `protected-baseline-${pkg.version}.json`);
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const protectedProfileFiles = ['package.json', 'cordis.patch.yml', 'cordis.yml', 'pnpm-lock.yaml'];
async function profileHashes() { return Object.fromEntries(await Promise.all(protectedProfileFiles.map(async name => [name, await hash(path.join(profile, name))]))); }
async function sourceHashes() {
  const files = {};
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || ['node_modules', '.git', '.agents', '.venv', 'venv', 'env', '.validation', 'archive'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|json|yml|yaml|md|css|svg|map)$/i.test(entry.name)) files[file] = await hash(file);
    }
  }
  for (const entry of await fs.readdir(path.dirname(root), { withFileTypes: true })) if (entry.isDirectory() && entry.name !== pkg.name) await visit(path.join(path.dirname(root), entry.name));
  return files;
}
if (process.argv.includes('--baseline')) {
  await fs.writeFile(baselineFile, JSON.stringify({ date: new Date().toISOString(), profile: await profileHashes(), sources: await sourceHashes() }, null, 2) + '\n');
  console.log('Saved current profile and other-plugin source/build baselines.');
} else {
  const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
  const currentManifest = JSON.parse(await fs.readFile(path.join(profile, 'package.json'), 'utf8'));
  if (!currentManifest.dsh?.profile?.bundles?.includes(pkg.name) || !currentManifest.dependencies?.[pkg.name]?.startsWith('link:')) throw new Error('The official profile must already select this link: bundle; no automatic profile edits.');
  if (!(await fs.lstat(link)).isSymbolicLink() || (await fs.realpath(link)).toLowerCase() !== target.toLowerCase()) throw new Error('Existing link is not this suite; refusing replacement.');
  if (process.argv.includes('--install')) {
    const preflight = JSON.parse(await fs.readFile(path.join(root, 'docs/preflight.json'), 'utf8'));
    const verification = JSON.parse(await fs.readFile(path.join(root, 'docs/verification.json'), 'utf8'));
    if (preflight.exitCode !== 0 || preflight.version !== pkg.version || !verification.ok || verification.version !== pkg.version) throw new Error('Current-version verification and composition must pass before link replacement.');
    const next = link + '.next-' + pkg.version, backup = link + '.previous-' + pkg.version;
    for (const candidate of [next, backup]) {
      if (path.dirname(candidate) !== path.join(profile, 'node_modules')) throw new Error('Link escaped intended directory');
      try { await fs.lstat(candidate); throw new Error('Refusing to overwrite staging link: ' + candidate); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    await fs.symlink(target, next, 'dir');
    if ((await fs.realpath(next)).toLowerCase() !== target.toLowerCase()) throw new Error('Symbolic link target mismatch');
    await fs.rename(link, backup);
    try { await fs.rename(next, link); } catch (error) { await fs.rename(backup, link); throw error; }
  }
  const afterProfile = await profileHashes();
  const afterSources = await sourceHashes();
  const profileUnchanged = JSON.stringify(afterProfile) === JSON.stringify(baseline.profile);
  const otherPluginsUnchanged = Object.keys(afterSources).length === Object.keys(baseline.sources).length && Object.entries(baseline.sources).every(([file, digest]) => afterSources[file] === digest);
  const externalDifferences = { added: Object.keys(afterSources).filter(file => !Object.hasOwn(baseline.sources, file)), changed: Object.keys(afterSources).filter(file => baseline.sources[file] && baseline.sources[file] !== afterSources[file]), removed: Object.keys(baseline.sources).filter(file => !Object.hasOwn(afterSources, file)) };
  const existingProtectedFilesUnchanged = externalDifferences.changed.length === 0 && externalDifferences.removed.length === 0;
  const report = { date: new Date().toISOString(), version: pkg.version, target, link, registered: true, requestedLinkType: 'SymbolicLink', replaced: process.argv.includes('--install'), profileUnchanged, otherPluginsUnchanged, existingProtectedFilesUnchanged, externalDifferences, protectedSourceFiles: Object.keys(afterSources).length, runtimeDependencies: [], internalDevelopmentPackages: JSON.parse(await fs.readFile(path.join(root, 'docs/local-dependencies.json'), 'utf8')).packages.length, liveApplication: 'not verified; no desktop restart performed', rollback: 'Restore archive/2.3.0 package/patch/lib/presets/locale/src/config files in place; use DSH plugin manager to apply. The link target stays this suite.' };
  await fs.writeFile(path.join(root, 'docs/installation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  // Concurrent added documentation is reported, never overwritten or folded into
  // the old baseline. Only drift of existing protected files blocks this check.
  if (!profileUnchanged || !existingProtectedFilesUnchanged) process.exit(1);
}
