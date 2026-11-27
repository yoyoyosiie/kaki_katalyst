// Turns an Anki-style furigana sentence into the characters you'll write.
//
// Anki furigana format (used by the Kaishi deck):
//   "朝[あさ]ご 飯[はん]を 食[た]べる。"
// The reading in [brackets] belongs to the text just before it, back to the
// previous space (or the start). Spaces are only separators.
//
// Pure logic, no DOM, so it's unit-tested in Node.

const KANJI = /[㐀-䶿一-鿿豈-﫿々]/;
// Characters that get no writing box (punctuation, brackets, spaces).
const NOT_WRITTEN = /[\s。、，．・！？!?「」『』（）()〜…]/;

export const isKanji = (ch) => KANJI.test(ch);
export const isWritten = (ch) => !NOT_WRITTEN.test(ch);

// "朝[あさ]ご 飯[はん]を" ->
//   [{text:'朝', reading:'あさ'}, {text:'ご'}, {text:'飯', reading:'はん'}, {text:'を'}]
export function parseFurigana(source) {
  const segments = [];
  for (const token of source.split(' ')) {
    let rest = token;
    let m;
    while ((m = /^([^[]*)\[([^\]]*)\]/.exec(rest))) {
      if (m[1]) segments.push({ text: m[1], reading: m[2] });
      rest = rest.slice(m[0].length);
    }
    if (rest) segments.push({ text: rest, reading: null });
  }
  return segments;
}

// Plain sentence with no readings: "朝ご飯を食べる。"
export function plainText(segments) {
  return segments.map((s) => s.text).join('');
}

// Decide what you actually write, box by box.
//
// A segment that contains any kanji you don't know yet is written entirely
// in hiragana (its reading). This keeps words like 今日 (きょう), whose reading
// can't be split per kanji, correct.
//
// Returns one entry per writing box:
//   { char, segment, hidden, given }
//   char:    what to write in the box
//   segment: index into `segments` (used to show the kanji on reveal)
//   hidden:  true if this box is hiragana standing in for unknown kanji
//   given:   true for an unknown kanji the deck gave no reading for; it's
//            printed in the box rather than written (we can't hide it)
export function writingBoxes(segments, known) {
  const boxes = [];
  const isUnknown = (ch) => isKanji(ch) && !known.has(ch);
  segments.forEach((seg, i) => {
    const unknown = Boolean(seg.reading) && [...seg.text].some(isUnknown);
    const chars = unknown ? [...seg.reading] : [...seg.text];
    for (const char of chars) {
      if (!isWritten(char)) continue;
      boxes.push({ char, segment: i, hidden: unknown, given: !unknown && isUnknown(char) });
    }
  });
  return boxes;
}
