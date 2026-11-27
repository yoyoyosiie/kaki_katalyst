// Turns an Anki "Notes in Plain Text" export of Kaishi 1.5k into lessons.
//
// In Anki: File → Export → "Notes in Plain Text (.txt)", tick "Include HTML
// and media references" either way. The file is tab-separated, may start
// with "#key:value" header lines, and quotes fields that contain tabs or
// line breaks.
//
// We don't rely on a fixed column order (it changes between deck versions
// and note types). Instead each column is recognised by what's in it:
//   sentence furigana: longest column with Anki furigana like 食[た]べる
//   word furigana:     shortest such column
//   sentence meaning:  long, (almost) always-filled English column
//
// Pure logic, no DOM, so it's unit-tested in Node.

import { isKanji, parseFurigana, plainText } from './furigana.js';

// ---- reading the file --------------------------------------------------

// Split tab-separated text into rows of fields, honouring "quoted" fields
// (which can contain tabs, newlines and "" for a literal quote).
export function parseTsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === '\t') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Remove HTML tags, entities and [sound:...] references, keep the text.
export function cleanField(s) {
  return s
    .replace(/\[sound:[^\]]*\]/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}

const FURIGANA = /[㐀-鿿々][^\s[\]]*\[[^\]]+\]/;
const LATIN = /[A-Za-z]/g;

function stats(rows, col, test) {
  let filled = 0, hits = 0, length = 0;
  for (const r of rows) {
    const v = r[col] || '';
    if (!v) continue;
    filled++;
    length += v.length;
    if (test(v)) hits++;
  }
  return { fill: filled / rows.length, hitRate: filled ? hits / filled : 0, avgLength: filled ? length / filled : 0 };
}

// Work out which column is which. Returns { word, sentence, english } as
// column indexes (word may be -1 if there's no word-furigana column).
export function detectColumns(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  const furi = [];
  const english = [];
  for (let c = 0; c < width; c++) {
    const f = stats(rows, c, (v) => FURIGANA.test(v));
    if (f.hitRate > 0.5 && f.fill > 0.5) furi.push({ c, ...f });
    const e = stats(rows, c, (v) => (v.match(LATIN) || []).length > v.length * 0.5);
    if (e.hitRate > 0.8 && e.fill > 0.9) english.push({ c, ...e });
  }
  if (!furi.length) {
    throw new Error('No furigana column found. Export the deck as "Notes in Plain Text" with HTML included.');
  }
  furi.sort((a, b) => b.avgLength - a.avgLength);
  english.sort((a, b) => b.avgLength - a.avgLength);
  return {
    sentence: furi[0].c,
    word: furi.length > 1 ? furi[furi.length - 1].c : -1,
    english: english.length ? english[0].c : -1,
  };
}

// ---- building lessons ----------------------------------------------------

// Full pipeline: export text -> { lessons, notes, columns }.
// One lesson per kanji, in the order it first appears in a word of the deck,
// using that card's sentence. A word with two new kanji makes two lessons.
export function lessonsFromExport(text) {
  const rows = parseTsv(text)
    .filter((r) => !(r.length === 1 && r[0].startsWith('#'))) // header lines
    .filter((r) => r.some((f) => f.trim()))
    .map((r) => r.map(cleanField));
  if (!rows.length) throw new Error('The file is empty.');

  const columns = detectColumns(rows);
  const seen = new Set();
  const lessons = [];
  for (const r of rows) {
    const sentence = r[columns.sentence];
    if (!sentence) continue;
    const word = columns.word >= 0 ? plainText(parseFurigana(r[columns.word])) : '';
    const english = columns.english >= 0 ? r[columns.english] : '';
    // Kanji introduced by this card: from the word if we have it, otherwise
    // from the sentence.
    const source = word || plainText(parseFurigana(sentence));
    for (const ch of source) {
      if (!isKanji(ch) || ch === '々' || seen.has(ch)) continue;
      seen.add(ch);
      lessons.push({ kanji: ch, word, sentence, english });
    }
  }
  return { lessons, notes: rows.length, columns };
}
