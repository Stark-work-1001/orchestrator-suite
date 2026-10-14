/** Create the sanitized GitHub tree; never copies private development state. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './toolchain.mjs';
import { packagedFiles, publicFiles, scanFiles } from './privacy-scan.mjs';
if (path.basename(root) !== 'dev') { console.log('Public sync skipped: run from the local dev workspace.'); process.exit(0); }
const target = path.resolve(root,'..','main');
if (path.dirname(target) !== path.dirname(root) || path.basename(target) !== 'main') throw new Error('Unsafe public target');
await fs.mkdir(target,{recursive:true});
const members = (await packagedFiles(root)).filter(name=>!name.startsWith('node_modules/'));
const scan = await scanFiles(root,members);
if (scan.findings.length) throw new Error('Source privacy findings; public tree not changed: '+JSON.stringify(scan.findings));
const manifest = new Set(members);
for (const name of members) { const file=path.join(target,name); await fs.mkdir(path.dirname(file),{recursive:true}); const old=await fs.lstat(file).catch(()=>null); if(old?.isSymbolicLink())throw new Error('Redirected public target'); await fs.copyFile(path.join(root,name),file); }
const actual=await publicFiles(target), extra=actual.filter(name=>!manifest.has(name));
if(extra.length)throw new Error('Unexpected public files require review: '+extra.join(', '));
const final=await scanFiles(target,actual); if(final.findings.length)throw new Error('Public tree privacy findings: '+JSON.stringify(final.findings));
console.log(JSON.stringify({publicFiles:actual.length,findings:0,localFilesCopied:0}));
