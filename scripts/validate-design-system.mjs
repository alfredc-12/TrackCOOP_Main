import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = '.agents/skills/trackcoop-design-system';
const skill = await readFile(`${base}/SKILL.md`, 'utf8');
// This skill uses only plain scalar frontmatter; no YAML dependency is required.
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1];
assert(frontmatter, 'Skill must have frontmatter');
assert.match(frontmatter, /^name: trackcoop-design-system$/m);
assert.match(frontmatter, /^description: .{40,}$/m);
assert(!/TODO|\[INSERT|\[REPLACE/.test(skill), 'No unfinished scaffolding');
for (const [, link] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) await access(path.join(base, link));

const css = await readFile('src/styles/design-tokens.css', 'utf8');
const colors = Object.fromEntries([...css.matchAll(/--coop-([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
for (const [ink, surface] of [['forest','surface'], ['green','canvas'], ['muted','surface'], ['placeholder','field'], ['success','success-bg'], ['warning','warning-bg'], ['danger','danger-bg'], ['forest','yellow']]) {
  const a = luminance(colors[ink]);
  const b = luminance(colors[surface]);
  const contrast = (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
  assert(contrast >= 4.5, `${ink}/${surface} contrast ${contrast.toFixed(2)} is below 4.5`);
  console.log(`${ink}/${surface}: ${contrast.toFixed(2)}:1`);
}
await access('docs/design-system/preview.html');
console.log('Skill identity, all nine linked references, runtime color pairs, and preview path validated.');
