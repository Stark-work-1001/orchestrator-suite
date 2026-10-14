/** Keep the suite-owned persona copies consistent with the canonical policy. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './toolchain.mjs';
const shared = await fs.readFile(path.join(root, 'src/shared.ts'), 'utf8');
const policy = /export const DISPATCH_POLICY = `([\s\S]*?)`;/u.exec(shared)?.[1];
if (!policy) throw new Error('Missing canonical dispatch policy');
for (const file of ['cordis.patch.yml', 'presets/dispatch-orchestrator.patch.yml']) {
  const filename = path.join(root, file), text = await fs.readFile(filename, 'utf8');
  const pattern = /(              prefix: \|\r?\n)[\s\S]*?(?=          - id: agent-instructions)/u;
  if (!pattern.test(text)) throw new Error('Missing suite persona section: ' + file);
  await fs.writeFile(filename, text.replace(pattern, (_match, header) => header + policy.split('\n').map(line => '                ' + line).join('\n') + '\n'));
}
