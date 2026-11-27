// Tests for importing an Anki plain-text export. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTsv, cleanField, lessonsFromExport } from '../js/deck.js';
import { parseFurigana, writingBoxes } from '../js/furigana.js';

// A hand-made export in the same shape as Kaishi's (not real deck content).
const sample = readFileSync(new URL('./fixtures/sample-export.txt', import.meta.url), 'utf8');

test('TSV parser handles quoted fields with tabs and doubled quotes', () => {
  assert.deepEqual(parseTsv('a\t"b\tc"\t"say ""hi"""\nd\te\tf\n'), [
    ['a', 'b\tc', 'say "hi"'],
    ['d', 'e', 'f'],
  ]);
});

test('cleanField strips HTML, entities and sound tags', () => {
  assert.equal(cleanField('<b>食[た]べる</b>&nbsp;[sound:x.mp3]'), '食[た]べる');
  assert.equal(cleanField('It&#39;s'), "It's");
});

test('finds the sentence, word and English columns by content', () => {
  const { columns, notes } = lessonsFromExport(sample);
  assert.equal(notes, 5);
  assert.deepEqual(columns, { sentence: 6, word: 3, english: 7 });
});

test('one lesson per new kanji, in deck order, with that card\'s sentence', () => {
  const { lessons } = lessonsFromExport(sample);
  assert.deepEqual(lessons.map((l) => l.kanji), ['私', '食', '事', '先', '生', '今', '日']);
  const shoku = lessons.find((l) => l.kanji === '食');
  assert.equal(shoku.word, '食べる');
  assert.equal(shoku.sentence, '朝[あさ]ご 飯[はん]を 食[た]べる。');
  assert.equal(shoku.english, 'I eat breakfast.');
  // 食事 introduces only 事, since 食 was already taught.
  assert.equal(lessons.find((l) => l.kanji === '事').word, '食事');
});

test('a file with no furigana gives a clear error', () => {
  assert.throws(() => lessonsFromExport('hello\tworld\n'), /No furigana column/);
});

test('an unknown kanji with no reading is printed, not hidden', () => {
  const boxes = writingBoxes(parseFurigana('猫が 好[す]き'), new Set(['好']));
  assert.deepEqual(boxes.map((b) => [b.char, b.given]), [['猫', true], ['が', false], ['好', false], ['き', false]]);
});
