# 書き Katalyst

Japanese handwriting practice for iPad + Apple Pencil and Android styluses.
It runs in the browser, so there's nothing to install.

## Lesson flow

For each new kanji:

1. **Trace** it 3 times over a gray outline.
2. **Freehand**: write it in an empty box.
3. **Trace sentence**: one box per character, each with its outline.
4. **Write sentence**: the same boxes with no outline. The prompt shows the
   sentence in kana only; words to write in kanji are highlighted, and so
   are their boxes.

Every stroke is checked for order, direction and shape.

In sentences:

- Words containing kanji you haven't learned yet are written in **hiragana**
  (a dotted line under the box). Pressing **Check** reveals the real
  sentence with those words highlighted.
- Sentence boxes use looser tolerances than the big box (`sentence-trace`
  and `sentence-freehand` in `js/config.js`), since they're smaller.
- **Kanji boxes block** (highlighted, with a red bar on top): a wrong stroke is rejected and you
  redo it. You can't move on until they're right.
- **Kana boxes don't block**: mistakes are kept and outlined in red when you
  press Check. (Set `KANA_BLOCKS: true` in `js/config.js` to change this.)

Finished kanji are remembered on the device (browser storage).

Content: sample lessons in `js/lessons.js` for now; the Kaishi 1.5k deck
comes next, introducing kanji in deck order.

## Running it locally

The app uses JavaScript modules, which browsers only load over HTTP, so
opening `index.html` directly won't work. From the repo folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Tests

```sh
npm test
```

This runs the grading tests in `tests/` with Node's built-in test runner.
There are no dependencies to install.

## How the code is laid out

| File | What it does |
| --- | --- |
| `js/config.js` | **All grading tolerances.** Tune strictness here. |
| `js/geometry.js` | Pure math: stroke length, resampling, distances, direction similarity. |
| `js/matcher.js` | Decides if a stroke is right, and why not (order, direction, position, shape, length). |
| `js/session.js` | One character being written: next stroke, mistakes, blocking vs feedback-only. |
| `js/furigana.js` | Parses Anki furigana (`食[た]べる`) and decides which words become hiragana. |
| `js/lessons.js` | The lesson list (sample lessons for now). |
| `js/progress.js` | Remembers finished kanji on the device. |
| `js/kanjivg.js` | Loads a kanji's strokes from a KanjiVG SVG file. |
| `js/inkpad.js` | The writing canvas: pen input, palm rejection, drawing. |
| `js/app.js` | The lesson flow and page UI. Add `?debug=1` to the URL for grading numbers. |
| `tools/fetch-kanjivg.mjs` | Downloads stroke files for every character the lessons use. |
| `data/kanjivg/` | KanjiVG stroke files, named by code point (`098df.svg` = 食). |

### How a stroke is graded

1. Both your stroke and the model stroke are resampled to 32 evenly spaced
   points, so point *i* on each is the same fraction of the way along.
2. **Direction:** if your start is nearer the model's end (and vice versa),
   you drew it backwards.
3. **Position:** your start and end points, and the average distance between
   matching points, must be within tolerance.
4. **Length and shape:** your stroke's length must be close to the model's,
   and each small segment must point roughly the same way.
5. **Order:** if a stroke fails but matches a *later* stroke, it's reported
   as a stroke-order mistake.

Dots and short ticks skip the direction/length/shape checks, since a tiny
wobble would flip them.

## Credits

Stroke data: [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel,
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
