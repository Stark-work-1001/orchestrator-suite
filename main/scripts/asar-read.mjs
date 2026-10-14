import fs from 'node:fs';
const file = process.argv[2], wanted = process.argv[3];
const fd = fs.openSync(file, 'r');
const lead = Buffer.alloc(16); fs.readSync(fd, lead, 0, 16, 0);
const header = Buffer.alloc(lead.readUInt32LE(12)); fs.readSync(fd, header, 0, header.length, 16);
const tree = JSON.parse(header.toString());
const rows = [];
function walk(node, prefix = '') { for (const [name, entry] of Object.entries(node.files ?? {})) { const path = prefix + name; if (entry.files) walk(entry, path + '/'); else rows.push({path, ...entry}); } }
walk(tree);
if (!wanted) console.log(rows.filter(r => /plugin-manager|ui-slots|skill-filesystem|typert|cordis.*inspect|bin\/dsh|cli/.test(r.path)).map(r=>r.path).join('\n'));
else {
  const row = rows.find(r=>r.path === wanted);
  if (!row) throw new Error('Not found: ' + wanted);
  if (row.unpacked) console.log(fs.readFileSync(file + '.unpacked/' + wanted, 'utf8'));
  else { const buffer = Buffer.alloc(row.size); fs.readSync(fd, buffer, 0, buffer.length, 8 + lead.readUInt32LE(4) + Number(row.offset)); console.log(buffer.toString()); }
}
fs.closeSync(fd);
