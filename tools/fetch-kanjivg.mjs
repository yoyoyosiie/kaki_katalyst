// Downloads KanjiVG stroke files for every character the sample lessons use.
// Run from the repo root:  node tools/fetch-kanjivg.mjs
// Files already in data/kanjivg/ are skipped. (The repo already bundles every
// character in Kaishi 1.5k plus all kana; anything missing at runtime is
// fetched from KanjiVG's GitHub.)

import { existsSync, writeFileSync } from 'node:fs';
import { SAMPLE_LESSONS as LESSONS } from '../js/lessons.js';
import { parseFurigana, isWritten } from '../js/furigana.js';

const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/';
const hex = (ch) => ch.codePointAt(0).toString(16).padStart(5, '0');

// Every character that could be written: lesson kanji, sentence text, and
// readings (shown as hiragana when a kanji isn't known yet).
const chars = new Set();
for (const lesson of LESSONS) {
  chars.add(lesson.kanji);
  for (const seg of parseFurigana(lesson.sentence)) {
    for (const ch of seg.text + (seg.reading || '')) if (isWritten(ch)) chars.add(ch);
  }
}

let fetched = 0;
for (const ch of chars) {
  const file = `data/kanjivg/${hex(ch)}.svg`;
  if (existsSync(file)) continue;
  const res = await fetch(BASE + hex(ch) + '.svg');
  if (!res.ok) {
    console.warn(`No KanjiVG file for ${ch} (${hex(ch)}): HTTP ${res.status}`);
    continue;
  }
  writeFileSync(file, await res.text());
  fetched++;
}
console.log(`${chars.size} characters used, ${fetched} downloaded.`);
