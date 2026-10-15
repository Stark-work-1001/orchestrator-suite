import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, dependency } from './toolchain.mjs';
await import('./sync-policy.mjs');
const { build } = await import(pathToFileURL(dependency('esbuild')).href);
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
await fs.mkdir(path.join(root, 'lib'), { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['src/host/index.ts'], outfile: pkg.main, bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: true });
const client = await build({ absWorkingDir: root, entryPoints: ['src/client/index.tsx'], outdir: 'lib', bundle: true, platform: 'browser', format: 'cjs', external: ['react'], define: { __SUITE_CSS__: JSON.stringify(await fs.readFile(path.join(root, 'src/client/board.css'), 'utf8')) }, write: false, target: 'es2022' });
const js = client.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = client.outputFiles.find(file => file.path.endsWith('.css')).text;
// Match the desktop host's ModuleLoader factory; React is provided by the host.
const wrapped = `window.__ModuleLoader__.load({id:"orchestrator-suite",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${js}\nreturn module.exports;}});\n`;
await fs.writeFile(path.join(root, 'lib/client.js'), wrapped);
await fs.writeFile(path.join(root, 'lib/client.css'), css);
console.log(`Built orchestrator-suite ${pkg.version}; host-provided React, no runtime dependencies.`);
