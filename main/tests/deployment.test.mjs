import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'suite-deploy-'));
  const source = path.join(dir, 'source'), target = path.join(dir, 'plugins', 'orchestrator-suite'), sibling = path.join(dir, 'plugins', 'unrelated'), profile = path.join(dir, 'profile');
  for (const p of [source, target, sibling, profile]) await fs.mkdir(p, { recursive: true });
  const write = async (base, name, text) => { const file = path.join(base, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); };
  for (const script of ['deploy-in-place.mjs', 'toolchain.mjs', 'privacy-scan.mjs']) await write(source, 'scripts/' + script, await fs.readFile(new URL('../scripts/' + script, import.meta.url), 'utf8'));
  await write(source, 'package.json', JSON.stringify({ name: 'orchestrator-suite', version: '3.0.0', files: ['lib', 'presets', 'suite.config.json'] }));
  await write(source, 'lib/host.js', 'new host'); await write(source, 'presets/owned.yml', 'new owned preset'); await write(source, 'suite.config.json', '{}');
  await write(source, 'docs/verification.json', JSON.stringify({ ok: true, version: '3.0.0' }));
  await write(source, 'docs/preflight.json', JSON.stringify({ version: '3.0.0', status: 'pass', newHost: true, newPreset: true, advisoryPolicy: true }));
  await write(target, 'package.json', JSON.stringify({ name: 'orchestrator-suite', version: '2.3.1' })); await write(target, 'lib/host.js', 'old host'); await write(target, 'suite.config.json', '{"memoryRoots":["local-data"],"custom":true}');
  await write(sibling, 'status.tsx', 'other status'); await write(sibling, 'presets/other.yml', 'other preset');
  await write(profile, 'package.json', JSON.stringify({ dependencies: { 'orchestrator-suite': 'link:../plugins/orchestrator-suite', other: 'link:other' }, dsh: { profile: { bundles: ['orchestrator-suite', 'other'] } } }));
  for (const name of ['cordis.yml', 'cordis.patch.yml', 'pnpm-lock.yaml']) await write(profile, name, 'unchanged profile');
  await fs.mkdir(path.join(profile, 'node_modules')); await fs.symlink(target, path.join(profile, 'node_modules/orchestrator-suite'), 'junction');
  const run = () => spawnSync(process.execPath, [path.join(source, 'scripts/deploy-in-place.mjs')], { encoding: 'utf8', windowsHide: true, env: { ...process.env, ORCHESTRATOR_PROFILE: profile, ORCHESTRATOR_INSTALL_DIR: target } });
  return { dir, source, target, sibling, profile, write, run };
}

test('in-place upgrade changes only suite files and preserves profile, unrelated status/preset and local config', async () => {
  const f = await fixture();
  try {
    const config = await fs.readFile(path.join(f.target, 'suite.config.json'), 'utf8'), profile = await fs.readFile(path.join(f.profile, 'package.json'), 'utf8');
    const result = f.run(); assert.equal(result.status, 0, result.stderr);
    assert.equal(await fs.readFile(path.join(f.target, 'lib/host.js'), 'utf8'), 'new host');
    assert.equal(await fs.readFile(path.join(f.target, 'suite.config.json'), 'utf8'), config);
    assert.equal(await fs.readFile(path.join(f.profile, 'package.json'), 'utf8'), profile);
    assert.equal(await fs.readFile(path.join(f.sibling, 'status.tsx'), 'utf8'), 'other status');
    assert.equal(await fs.readFile(path.join(f.sibling, 'presets/other.yml'), 'utf8'), 'other preset');
    const report = JSON.parse(await fs.readFile(path.join(f.source, 'docs/installation.json')));
    assert.equal(report.profileUnchanged, true); assert.equal(report.removedFiles, 0);
    assert.equal(await fs.readFile(path.join(report.backup, 'lib/host.js'), 'utf8'), 'old host');
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});

test('redirected installation parent is refused and earlier writes roll back without touching the external file', async () => {
  const f = await fixture();
  try {
    await f.write(f.sibling, 'owned.yml', 'external original'); await fs.symlink(f.sibling, path.join(f.target, 'presets'), 'junction');
    const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /escapes suite/);
    assert.equal(await fs.readFile(path.join(f.target, 'lib/host.js'), 'utf8'), 'old host');
    assert.equal(JSON.parse(await fs.readFile(path.join(f.target, 'package.json'))).version, '2.3.1');
    assert.equal(await fs.readFile(path.join(f.sibling, 'owned.yml'), 'utf8'), 'external original');
  } finally { await fs.rm(f.dir, { recursive: true, force: true }); }
});
