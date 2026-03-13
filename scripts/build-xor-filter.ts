/**
 * Usage:
 *   npm run build:wordfilter
 *
 * Or directly:
 *   npx tsx scripts/build-xor-filter.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { XorFilter } = require("bloom-filters");

const WORDS_TXT = path.resolve("build-assets/margana-word-list.txt");
const OUT_DIR   = path.resolve("src/assets/word-filters");

function normalize(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(w => w.trim().toLowerCase())
    .filter(w => /^[a-z]{3,10}$/.test(w));
}

const raw = fs.readFileSync(WORDS_TXT, "utf8");
const words = normalize(raw);

// bucket by length 3..10
const buckets = new Map<number, string[]>();
for (let len = 3; len <= 10; len++) buckets.set(len, []);

for (const w of words) buckets.get(w.length)!.push(w);

fs.mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
for (let len = 3; len <= 10; len++) {
  const list = buckets.get(len)!;
  total += list.length;

  const filter = XorFilter.create(list, 16);
  const outPath = path.resolve(OUT_DIR, `word-filter-len-${len}.json`);
  fs.writeFileSync(outPath, JSON.stringify(filter.saveAsJSON()));

  console.log(`✅ len=${len}: ${list.length} words -> ${outPath}`);
}

console.log(`Done. Total words: ${total}`);
