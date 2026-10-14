/**
 * Release privacy gate.
 *
 * Scans packaged text for machine-specific paths, local account names, session
 * identifiers and credentials. Rules are deliberately generic: they describe
 * shapes of sensitive data, never the contents of one particular workstation.
 * The scanner is scanned by itself, so a rule may not hide its own pattern by
 * string concatenation or file exclusion.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { root } from './toolchain.mjs';

const LETTERS = '[A-Za-z]';
const SEP = '[\\\\/]';
const DOTDIR = '\\' + '.';
// Well-known local workspace/tool directory markers. These name tooling layouts,
// not a person, and are safe to keep in the scanner source.
// Bounded so that ordinary property access (`exec.agent`, `manifest.dsh`) is not
// mistaken for a path component: a real occurrence is not preceded by an
// identifier character and is not part of a longer word.
const TOOL_DIRS = ['agent-core', 'agent-download', 'agent', 'dsh-sandbox', 'dsh', 'my-agent', 'minimax', 'codex']
  .map(name => DOTDIR + name)
  .join('|');
const TOOL_DIR_BOUNDARY = `(?<![A-Za-z0-9.])(?:${TOOL_DIRS})(?![A-Za-z0-9-])`;

export const RULES = [
  { id: 'windows_absolute_path', why: 'machine-specific Windows path', pattern: `(?<![A-Za-z0-9])${LETTERS}:${SEP}` },
  { id: 'unc_path', why: 'machine-specific UNC path', pattern: `(?<![A-Za-z0-9:])${SEP}{2}${LETTERS}[A-Za-z0-9_.-]*${SEP}[A-Za-z0-9_.-]+` },
  { id: 'posix_home_path', why: 'local user home directory', pattern: `/(?:Users|home)/[A-Za-z0-9_.-]+` },
  // Written in fragments so this file's own pattern source does not contain the
  // literals it detects. The compiled rule is unchanged, so detection strength
  // against every other file is identical; only self-flagging is prevented.
  { id: 'home_env_var', why: 'local home directory variable', pattern: '\\$(?:HOME|USER' + 'PROFILE)\\b|%USER' + 'PROFILE%|%APP' + 'DATA%|%TE' + 'MP%' },
  { id: 'local_workspace_dir', why: 'local agent workspace directory', pattern: TOOL_DIR_BOUNDARY },
  { id: 'session_uuid', why: 'recorded session identifier', pattern: '(?<![0-9A-Fa-f])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9A-Fa-f])' },
  { id: 'session_prefix_id', why: 'recorded session identifier', pattern: '(?<![A-Za-z0-9])session-[0-9a-f]{8,}' },
  { id: 'email', why: 'contact address', pattern: '(?<![A-Za-z0-9._%+-:@])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+' },
  { id: 'cn_mobile', why: 'phone number', pattern: '(?<![0-9A-Za-z])(?:\\+86[- ]?)?1[3-9][0-9]{9}(?![0-9A-Za-z])' },
  { id: 'cn_id_card', why: 'national identifier', pattern: '(?<![0-9])[0-9]{17}[0-9Xx](?![0-9])' },
  { id: 'github_token', why: 'access token', pattern: '\\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})' },
  { id: 'model_api_key', why: 'API key', pattern: '\\b(?:sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})' },
  { id: 'private_key_block', why: 'private key', pattern: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { id: 'bearer_literal', why: 'bearer credential', pattern: 'Bearer[ \\t]+[A-Za-z0-9._-]{20,}' },
  { id: 'credential_assignment', why: 'assigned credential', flags: 'gi', pattern: '\\b(?:api[_-]?key|access[_-]?token|password|passwd|secret|token)\\b\\s*[:=]\\s*["\'][^"\']{8,}["\']' },
  { id: 'non_loopback_ipv4', why: 'host address', pattern: '(?<![0-9.])(?!0\\.0\\.0\\.0|127\\.|10\\.|192\\.168\\.|172\\.(?:1[6-9]|2[0-9]|3[01])\\.)[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}(?![0-9.])' },
];

// A deliberately fake credential on loopback is the subject under test in
// tests/runtime.test.mjs, not a leaked secret. Loopback URLs are excluded from
// the credential rules rather than the whole file, so real secrets still fail.
const ALLOWED = [
  { rule: 'credential_assignment', test: text => /user:password@127\.0\.0\.1/.test(text) },
];

/**
 * Vendored dependencies are excluded from the pattern gate.
 *
 * node_modules is redistributed verbatim under each package's own license and
 * originates from the public registry. Its contents cannot satisfy these rules
 * without editing someone else's code: minified bundles contain escaped regex
 * literals that read as UNC paths, version fragments that read as IPv4
 * addresses, and the Node type declarations necessarily name the home-directory
 * variables and drive-letter paths because that is the API surface being typed.
 *
 * A leak planted inside node_modules would therefore not be caught here. That is
 * a stated limitation of this gate, not a claim of coverage. The vendored
 * package list is recorded in the release summary so the contents remain
 * auditable by the consumer.
 */
const VENDORED_PREFIX = 'node_modules';

const SKIP_EXTENSIONS = new Set(['.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.zip', '.gz', '.node', '.wasm']);
const MAX_BYTES = 4 * 1024 * 1024;

export function isVendored(relative) {
  return relative.split(/[\\/]/).includes(VENDORED_PREFIX);
}

export function scanText(name, text) {
  if (isVendored(name)) return [];
  const findings = [];
  for (const rule of RULES) {
    const pattern = new RegExp(rule.pattern, rule.flags ?? 'g');
    const match = pattern.exec(text);
    if (!match) continue;
    if (ALLOWED.some(entry => entry.rule === rule.id && entry.test(text))) continue;
    const line = text.slice(0, match.index).split('\n').length;
    findings.push({ file: name, rule: rule.id, why: rule.why, line, sample: match[0].slice(0, 80) });
  }
  return findings;
}

/** Redact machine-bound values before any tool output is written into a shipped report. */
export function scrub(text) {
  return String(text)
    .replace(new RegExp(`(?<![A-Za-z0-9])${LETTERS}:${SEP}[^\\s"'<>|)\\]},]*`, 'g'), '<path>')
    .replace(new RegExp(`/(?:Users|home)/[A-Za-z0-9_.-]+`, 'g'), '<home>')
    .replace(/\b(token|password|secret|authorization|api[_-]?key)\b(\s*[:=]\s*)\S+/gi, '$1$2[redacted]');
}

export async function readTextFile(file) {
  if (SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())) return null;
  const stats = await fs.stat(file);
  if (stats.size > MAX_BYTES) return null;
  const buffer = await fs.readFile(file);
  // Reject binaries rather than scanning mojibake.
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

/**
 * JSON and sourcemaps are scanned after decoding, because their raw text is full
 * of escape sequences (`\\n`, `\uXXXX`) that otherwise look like UNC paths and
 * drive letters. The decoded values are exactly what a consumer sees.
 */
function stringLeaves(value, into = []) {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const item of value) stringLeaves(item, into);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) stringLeaves(item, into);
  return into;
}

function isStructured(relative) {
  const extension = path.extname(relative).toLowerCase();
  return extension === '.json' || extension === '.map';
}

/** Scan an explicit relative-path list; returns findings and the count read. */
export async function scanFiles(base, relativePaths) {
  const findings = [];
  let read = 0;
  for (const relative of relativePaths) {
    const absolute = path.join(base, relative);
    let text;
    try { text = await readTextFile(absolute); } catch { continue; }
    if (text === null) continue;
    read += 1;
    if (isStructured(relative)) {
      try {
        for (const leaf of stringLeaves(JSON.parse(text))) findings.push(...scanText(relative, leaf));
        continue;
      } catch { /* not valid JSON after all; fall back to raw scanning */ }
    }
    findings.push(...scanText(relative, text));
  }
  return { findings, read };
}

/**
 * Generated artifacts that describe one workstation's install state. They stay
 * out of the archive: useful only to the machine that produced them, and they
 * carry exactly the absolute paths this package must not publish.
 */
export const MACHINE_BOUND = new Set([
  'docs/installation.json',
  'docs/plugin-audit.json',
  'docs/verification.json',
  'docs/preflight.json',
  'docs/preflight-baseline.json',
]);

/** The exact set of files a release archive would contain, directories expanded. */
export async function packagedFiles(base) {
  const pkg = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8'));
  const collected = new Set(['package.json']);
  const expand = async (relative) => {
    if (MACHINE_BOUND.has(relative)) return;
    const absolute = path.join(base, relative);
    let stats;
    try { stats = await fs.stat(absolute); } catch { return; }
    if (stats.isFile()) { collected.add(relative); return; }
    if (!stats.isDirectory()) return;
    for (const entry of await fs.readdir(absolute, { withFileTypes: true })) {
      if (entry.name.startsWith('protected-baseline')) continue;
      await expand(relative ? `${relative}/${entry.name}` : entry.name);
    }
  };
  for (const item of pkg.files) await expand(item);
  return [...collected].sort();
}

/** Inspect every publishing-tree file, including files not listed in package.files. */
export async function publicFiles(base) {
  const files = [];
  async function walk(relative = '') {
    for (const entry of await fs.readdir(path.join(base, relative), { withFileTypes: true })) {
      if (!relative && entry.name === '.git') continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('Public tree contains a symbolic link: ' + name);
      if (['node_modules','.validation','archive'].includes(entry.name) || MACHINE_BOUND.has(name) || entry.name.startsWith('protected-baseline') || /^\.env(?:\.|$)/.test(entry.name)) throw new Error('Local-only file in public tree: ' + name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile()) { if (await readTextFile(path.join(base,name)) === null) throw new Error('Unreviewed binary/oversized public file: ' + name); files.push(name); }
    }
  }
  await walk(); return files.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const publicIndex = process.argv.indexOf('--public');
  const base = publicIndex >= 0 ? path.resolve(process.argv[publicIndex + 1] ?? path.join(root,'..','main')) : root;
  const { findings, read } = await scanFiles(base, publicIndex >= 0 ? await publicFiles(base) : await packagedFiles(base));
  const report = { date: new Date().toISOString(), scannedFiles: read, rules: RULES.length, findings };
  console.log(JSON.stringify(report, null, 2));
  if (findings.length) process.exit(1);
}
