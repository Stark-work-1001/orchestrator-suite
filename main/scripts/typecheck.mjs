import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { root, dependency } from './toolchain.mjs';
const nodeTypes = path.dirname(path.dirname(dependency('@types/node/package.json')));
const reactTypes = path.dirname(dependency('@types/react/package.json'));
const { default: ts } = await import(pathToFileURL(dependency('typescript')).href);
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile).config;
config.compilerOptions.typeRoots = [nodeTypes, path.dirname(reactTypes)];
config.compilerOptions.paths = { react: [path.join(reactTypes, 'index.d.ts')], 'react/*': [path.join(reactTypes, '*')] };
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) { console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f=>f, getCurrentDirectory: ()=>root, getNewLine: ()=>'\n' })); process.exit(1); }
console.log('TypeScript check passed.');
