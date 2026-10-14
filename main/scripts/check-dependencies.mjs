import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire, builtinModules } from 'node:module';
import { root } from './toolchain.mjs';
const inventory = JSON.parse(await fs.readFile(path.join(root, 'docs/local-dependencies.json'), 'utf8'));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const canonicalRoot = await fs.realpath(root), failures = [];
const inside = file => { const relative = path.relative(canonicalRoot, file); return !relative.startsWith('..') && !path.isAbsolute(relative); };
for (const entry of inventory.packages) {
  const dir = path.join(root, entry.directory);
  if (!inside(await fs.realpath(dir))) failures.push(`${entry.name}: package escaped suite`);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
  const resolver = createRequire(path.join(dir, 'package.json'));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    let resolved;
    try { resolved = resolver.resolve(dependency + '/package.json'); }
    catch { try { resolved = resolver.resolve(dependency); } catch { failures.push(`${entry.name}: missing ${dependency}`); continue; } }
    if (!inside(await fs.realpath(resolved))) failures.push(`${entry.name}: foreign dependency ${dependency}`);
  }
}
const host = await fs.readFile(path.join(root, pkg.main), 'utf8');
const imports = [...host.matchAll(/from ["']([^"']+)["']/g)].map(match => match[1]);
for (const name of imports) if (!name.startsWith('node:') && !builtinModules.includes(name)) failures.push('Unexpected host import: ' + name);
const report = { date: new Date().toISOString(), version: pkg.version, packages: inventory.packages.length, allInsideSuite: failures.length === 0, hostImports: imports, failures, note: 'React is supplied by the public host client module registry; development React and test/build packages are also physically bundled inside this suite.' };
await fs.writeFile(path.join(root, 'docs/dependency-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
