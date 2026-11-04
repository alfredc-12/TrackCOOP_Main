import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Source inventory only: this deliberately does not inspect .env, uploads, or database data.
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(tsx?|css)$/.test(file) && !/\.(test|spec)\./.test(file)) files.push(file.replaceAll('\\', '/'));
  }
}
await walk('src');
files.sort();
const colors = new Map();
const components = new Map();
const routes = [];
const patterns = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/#[0-9a-f]{6}\b/gi)) {
    const key = match[0].toLowerCase();
    const item = colors.get(key) || { color: key, count: 0, files: new Set() };
    item.count++;
    item.files.add(file);
    colors.set(key, item);
  }
  const imports = [...source.matchAll(/from\s+["'](@\/[^"']+)["']/g)].map((match) => match[1]);
  for (const name of imports) components.set(name, (components.get(name) || 0) + 1);
  if (/\/page\.tsx$/.test(file)) routes.push({ file, route: file.replace(/^src\/app/, '').replace(/\/\([^/]+\)/g, '').replace(/\/page\.tsx$/, '') || '/', imports });
  const flags = [];
  if (/h-screen[^"']*overflow-hidden|overflow-hidden[^"']*h-screen/.test(source)) flags.push('fixed viewport with hidden overflow: inspect in browser');
  if (/\bMath\.random\(/.test(source)) flags.push('randomness: inspect whether render-time ID');
  if (/\btext-(?:\[10px\]|\[11px\]|\[0\.68rem\])/.test(source)) flags.push('small text: inspect labels and contrast');
  if (/bg-gradient|linear-gradient/.test(source)) flags.push('gradient: preserve intentional photography treatments; review decorative chrome');
  if (flags.length) patterns.push({ file, flags });
}
const inventory = {
  generatedBy: 'node scripts/audit-ui.mjs',
  scope: 'Source-read inventory of all src TS/TSX/CSS excluding tests; not a claim of rendered coverage.',
  sourceFileCount: files.length,
  routeCount: routes.length,
  colors: [...colors.values()].sort((a, b) => b.count - a.count).map((item) => ({ ...item, files: [...item.files] })),
  sharedImports: [...components].sort((a, b) => b[1] - a[1]).map(([module, count]) => ({ module, count })),
  routes,
  reviewCandidates: patterns,
};
await mkdir('docs/design-system', { recursive: true });
await writeFile('docs/design-system/source-inventory.json', JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ sourceFiles: files.length, routes: routes.length, colors: inventory.colors.slice(0, 15).map(({ color, count }) => ({ color, count })), shared: inventory.sharedImports.slice(0, 14) }, null, 2));
