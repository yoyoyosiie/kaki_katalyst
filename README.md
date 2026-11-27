# 書き Katalyst

Japanese handwriting practice for iPad + Apple Pencil and Android styluses.
It runs in the browser, so there's nothing to install.

Lesson flow (being built step by step):

1. Trace a new kanji 3 times, then write it freehand.
2. Trace a sentence that uses it once, then write the sentence freehand in
   grid boxes. Kanji you haven't covered yet are shown as hiragana.
3. Every stroke is checked for order, direction and shape.

Content comes from the Kaishi 1.5k deck, introducing kanji in deck order.

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
| `js/kanjivg.js` | Loads a kanji's strokes from a KanjiVG SVG file. |
| `js/inkpad.js` | The writing canvas: pen input, palm rejection, drawing. |
| `js/app.js` | Wires it together into the practice page. |
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
