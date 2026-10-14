import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function dependency(name) {
  try { return createRequire(path.join(root, 'package.json')).resolve(name); }
  catch { throw new Error(`Missing internal dependency ${name}; restore the self-contained release node_modules. No foreign plugin fallback or automatic download.`); }
}
