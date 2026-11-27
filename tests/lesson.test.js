// Tests for sentence parsing and per-character grading rules. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFurigana, writingBoxes, plainText } from '../js/furigana.js';
import { CharSession } from '../js/session.js';

test('parses Anki furigana', () => {
  assert.deepEqual(parseFurigana('朝[あさ]ご 飯[はん]を 食[た]べる。'), [
    { text: '朝', reading: 'あさ' },
    { text: 'ご', reading: null },
    { text: '飯', reading: 'はん' },
    { text: 'を', reading: null },
    { text: '食', reading: 'た' },
    { text: 'べる。', reading: null },
  ]);
});

test('plain text drops the readings', () => {
  assert.equal(plainText(parseFurigana('あの 人[ひと]は 先生[せんせい]です。')), 'あの人は先生です。');
});

test('unknown kanji become hiragana; known ones stay; punctuation gets no box', () => {
  const boxes = writingBoxes(parseFurigana('朝[あさ]ご 飯[はん]を 食[た]べる。'), new Set(['食']));
  assert.equal(boxes.map((b) => b.char).join(''), 'あさごはんを食べる');
  assert.deepEqual(boxes.filter((b) => b.hidden).map((b) => b.char), ['あ', 'さ', 'は', 'ん']);
});

test('a word with any unknown kanji goes fully to hiragana (今日 -> きょう)', () => {
  const boxes = writingBoxes(parseFurigana('今日[きょう]は'), new Set(['今']));
  assert.equal(boxes.map((b) => b.char).join(''), 'きょうは');
});

test('once all kanji are known, the sentence is written with kanji', () => {
  const boxes = writingBoxes(parseFurigana('先生[せんせい]です'), new Set(['先', '生']));
  assert.equal(boxes.map((b) => b.char).join(''), '先生です');
});

// Two-stroke model: horizontal then vertical (a 十).
const line = (ax, ay, bx, by, n = 20) =>
  Array.from({ length: n }, (_, i) => ({ x: ax + ((bx - ax) * i) / (n - 1), y: ay + ((by - ay) * i) / (n - 1) }));
const strokes = [{ points: line(20, 55, 90, 55) }, { points: line(55, 15, 55, 95) }];
const wrong = line(20, 100, 90, 100);

test('blocking session rejects a wrong stroke and waits for a redo', () => {
  const s = new CharSession({ char: '十', strokes, mode: 'trace', blocking: true });
  assert.equal(s.handle(wrong).action, 'reject');
  assert.equal(s.index, 0);
  assert.equal(s.handle(wrong).hint, true); // second miss shows a hint
  assert.equal(s.handle(strokes[0].points).action, 'accept');
  assert.equal(s.handle(strokes[1].points).action, 'accept');
  assert.equal(s.done, true);
  assert.equal(s.hasErrors, false);
});

test('feedback-only session keeps a wrong stroke, records it, and moves on', () => {
  const s = new CharSession({ char: 'か', strokes, mode: 'freehand', blocking: false });
  assert.equal(s.handle(wrong).action, 'mistake');
  assert.equal(s.index, 1);
  assert.equal(s.handle(strokes[1].points).action, 'accept');
  assert.equal(s.done, true);
  assert.equal(s.hasErrors, true);
  assert.equal(s.errors[0].stroke, 0);
});

test('an unfinished character counts as having errors', () => {
  const s = new CharSession({ char: 'か', strokes, mode: 'freehand', blocking: false });
  s.handle(strokes[0].points);
  assert.equal(s.hasErrors, true);
});
