/** One-time local copy of existing development packages; never downloads. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './toolchain.mjs';
const source = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Pass an existing local package toolchain directory');
const seed = createRequire(path.join(source, 'package.json'));
const copied = new Map(), inventory = [];
async function locate(requireFrom, name) {
  let file;
  try { file = requireFrom.resolve(name + '/package.json'); }
  catch { file = requireFrom.resolve(name); }
  let dir = path.dirname(file);
  for (;;) {
    try { const manifest = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8')); if (manifest.name === name) return { dir, manifest }; } catch {}
    const parent = path.dirname(dir); if (parent === dir) throw new Error('Cannot locate manifest for ' + name); dir = parent;
  }
}
async function install(requireFrom, name, optional = false, parentDest) {
  let info;
  try { info = await locate(requireFrom, name); } catch (error) { if (optional) return; throw error; }
  const key = `${info.manifest.name}@${info.manifest.version}`;
  let dest = path.join(root, 'node_modules', name);
  const rootCopy = copied.get(name);
  if (rootCopy && rootCopy !== key) dest = path.join(parentDest, 'node_modules', name);
  if (copied.get(dest) === key) return;
  copied.set(dest, key); if (!rootCopy) copied.set(name, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(info.dir, dest, { recursive: true, dereference: true, filter: candidate => path.basename(candidate) !== 'node_modules' });
  inventory.push({ name, version: info.manifest.version, directory: path.relative(root, dest).replaceAll('\\', '/') });
  const resolver = createRequire(path.join(info.dir, 'package.json'));
  for (const dependency of Object.keys(info.manifest.dependencies ?? {})) await install(resolver, dependency, false, dest);
  for (const dependency of Object.keys(info.manifest.optionalDependencies ?? {})) await install(resolver, dependency, true, dest);
}
for (const name of ['react', 'react-dom', 'jsdom', 'typescript', 'esbuild', '@types/node', '@types/react']) await install(seed, name);
await fs.mkdir(path.join(root, 'docs'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/local-dependencies.json'), JSON.stringify({ date: new Date().toISOString(), method: 'Copied from existing local development packages, no network; all dependencies materialized under suite node_modules', packages: inventory }, null, 2) + '\n');
console.log(`Materialized ${inventory.length} local dependency packages inside orchestrator-suite.`);
