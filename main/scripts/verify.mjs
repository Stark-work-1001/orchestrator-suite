import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './toolchain.mjs';
import { scrub, packagedFiles, scanFiles, isVendored, MACHINE_BOUND } from './privacy-scan.mjs';

const checks = [];
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const steps = [
  ['scripts/typecheck.mjs'],
  ['scripts/build.mjs'],
  ['scripts/check-dependencies.mjs'],
  ['--test', 'tests/client.test.mjs', 'tests/runtime.test.mjs', 'tests/deployment.test.mjs'],
  ['scripts/preflight.mjs'],
  ['scripts/privacy-scan.mjs'],
  ['scripts/sync-public.mjs'],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: process.env, windowsHide: true, timeout: 120000 });
  // Captured output can contain absolute staging paths and credentials; scrub before
  // it is written anywhere.
  checks.push({ command: 'node ' + args.join(' '), exitCode: result.status, stdout: scrub(result.stdout ?? ''), stderr: scrub(result.stderr ?? '') });
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) break;
}

// A skipped preflight is reported as skipped. It is not a failure, and it is
// never counted as evidence that the suite composes against a real host.
const preflight = await fs.readFile(path.join(root, 'docs/preflight.json'), 'utf8').then(JSON.parse).catch(() => null);
const preflightState = !preflight ? 'not run' : preflight.status === 'skipped' ? 'skipped (no host configured)' : preflight.status;
const ok = checks.length === steps.length && checks.every(c => c.exitCode === 0);

// Two artifacts with deliberately different audiences.
//   verification.json  full local transcript; machine-bound, never packaged.
//   RELEASE-SUMMARY.json  what ships: outcomes only, no captured output, so the
//                         package cannot inherit paths, UUIDs or scan findings
//                         that existed in the machine that built it.
await fs.writeFile(path.join(root, 'docs/verification.json'), JSON.stringify({
  date: new Date().toISOString(), version: pkg.version, ok, checks, preflight: preflightState, liveHost: 'not verified', paidJudgeCalls: 0,
}, null, 2) + '\n');

// The vendored dependency set is excluded from the pattern gate, so record it in
// the shipped summary: the consumer can then audit exactly what is inside.
const vendored = new Set();
for (const item of await packagedFiles(root)) {
  if (!isVendored(item)) continue;
  const parts = item.split('/');
  vendored.add(parts[1].startsWith('@') ? `${parts[1]}/${parts[2]}` : parts[1]);
}

const summary = {
  version: pkg.version, ok, liveHost: 'not verified', paidJudgeCalls: 0, preflight: preflightState,
  checks: checks.filter(c => !/privacy-scan|sync-public/.test(c.command)).map(({ command, exitCode }) => ({ command, exitCode })),
  vendoredPackages: [...vendored].sort(),

};
await fs.writeFile(path.join(root, 'docs/RELEASE-SUMMARY.json'), JSON.stringify(summary, null, 2) + '\n');

// Prove the shipped summary is clean rather than assuming it.
const shipped = (await packagedFiles(root)).filter(item => item === 'docs/RELEASE-SUMMARY.json');
const rescan = await scanFiles(root, shipped);
if (rescan.findings.length) {
  console.error('\nRelease summary failed the privacy scan:', JSON.stringify(rescan.findings, null, 2));
  process.exit(1);
}
if (ok && path.basename(root) === 'dev') {
  const published = spawnSync(process.execPath, ['scripts/sync-public.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  process.stdout.write(published.stdout ?? ''); process.stderr.write(published.stderr ?? '');
  if (published.status !== 0) process.exit(1);
}
console.log(`\nverify: ok=${ok} checks=${checks.length}/${steps.length} preflight=${preflightState}`);
if (!ok) process.exit(1);
