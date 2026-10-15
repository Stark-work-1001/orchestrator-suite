import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { root } from './toolchain.mjs';
import { packagedFiles, scanFiles, scrub } from './privacy-scan.mjs';

const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
// The shipped summary, not the local transcript: the transcript is machine-bound
// and is deliberately excluded from the archive.
const summary = JSON.parse(await fs.readFile(path.join(root, 'docs/RELEASE-SUMMARY.json'), 'utf8'));
if (!summary.ok || summary.version !== pkg.version) throw new Error('Release verification must pass first');

// Default is relative to this suite, never a fixed workstation location.
const output = path.resolve(process.argv[2] ?? path.join(root, '..', 'release'));
await fs.mkdir(output, { recursive: true });
const filename = `${pkg.name}-${pkg.version}.tar.gz`, archive = path.join(output, filename);
try { await fs.lstat(archive); throw new Error('Refusing to overwrite existing release: ' + archive); } catch (e) { if (e.code !== 'ENOENT') throw e; }

// The archive is built from exactly the list that was scanned, so a gate
// result can never describe a different set of files than the one shipped.
const members = await packagedFiles(root);
const scan = await scanFiles(root, members);
if (scan.findings.length) throw new Error('Privacy scan blocked the release:\n' + JSON.stringify(scan.findings, null, 2));

await fs.mkdir(path.join(root, '.validation'), { recursive: true });
const stage = await fs.mkdtemp(path.join(root, '.validation', 'release-'));
const packageDir = path.join(stage, pkg.name); await fs.mkdir(packageDir);
for (const item of members) {
  const source = path.join(root, item), target = path.join(packageDir, item);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}
const files = [];
for (const relative of members) {
  files.push({ path: relative, sha256: createHash('sha256').update(await fs.readFile(path.join(packageDir, relative))).digest('hex') });
}
await fs.writeFile(path.join(packageDir, 'RELEASE-MANIFEST.json'), JSON.stringify({ name: pkg.name, version: pkg.version, date: new Date().toISOString(), files }, null, 2) + '\n');

function tar(args) { const result = spawnSync('tar', args, { windowsHide: true, encoding: 'utf8', timeout: 120000 }); if (result.status !== 0) throw new Error(result.stderr || 'tar failed'); return result.stdout; }
tar(['-czf', archive, '-C', stage, pkg.name]);

// Re-scan the extracted archive, not just the staging tree: this is the only
// check that proves what a consumer actually receives is clean.
const extraction = path.join(stage, 'extracted'); await fs.mkdir(extraction);
tar(['-xzf', archive, '-C', extraction]);
const extracted = path.join(extraction, pkg.name);
for (const file of files) {
  const bytes = await fs.readFile(path.join(extracted, file.path));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Archive mismatch: ' + file.path);
}
const shipped = (await packagedFiles(extracted));
const rescan = await scanFiles(extracted, shipped);
if (rescan.findings.length) throw new Error('Extracted archive failed the privacy scan:\n' + JSON.stringify(rescan.findings, null, 2));

const extractedPkg = JSON.parse(await fs.readFile(path.join(extracted, 'package.json'), 'utf8'));
const module = await import(pathToFileURL(path.join(extracted, extractedPkg.main)).href);
if (module.name !== pkg.name || extractedPkg.version !== pkg.version) throw new Error('Release entry mismatch');
const digest = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
await fs.writeFile(archive + '.sha256', digest + '  ' + filename + '\n');

const report = {
  version: pkg.version, archive: scrub(archive), sha256: digest, bytes: (await fs.stat(archive)).size,
  packagedFiles: members.length, extractionVerified: true,
  includesDependencies: true, liveApplication: 'not verified; see DEPLOYMENT.md',
};
await fs.writeFile(path.join(output, `${pkg.name}-${pkg.version}.release.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
