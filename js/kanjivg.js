// Loads a kanji's stroke data from a KanjiVG SVG file.
//
// KanjiVG (https://kanjivg.tagaini.net) stores each kanji as an SVG where
// every stroke is a <path> with an id like "kvg:098df-s3" (stroke 3 of 食).
// The paths are already in correct Japanese stroke order and direction.

const SVG_NS = 'http://www.w3.org/2000/svg';
const POINTS_PER_PATH = 64;

// "食" -> "098df" (KanjiVG file names are the 5-digit hex code point)
export function codepointHex(char) {
  return char.codePointAt(0).toString(16).padStart(5, '0');
}

const cache = new Map();

// Returns { char, strokes: [{ d, points: [{x, y}, ...] }, ...] }
// `d` is the raw SVG path (used for drawing the guide);
// `points` are samples along it (used for grading).
// Results are cached, so loading the same character twice is free.
export function loadKanji(char, baseUrl = 'data/kanjivg/') {
  if (!cache.has(char)) {
    const p = fetchKanji(char, baseUrl);
    p.catch(() => cache.delete(char)); // allow a retry after a failure
    cache.set(char, p);
  }
  return cache.get(char);
}

async function fetchKanji(char, baseUrl) {
  const hex = codepointHex(char);
  const res = await fetch(`${baseUrl}${hex}.svg`);
  if (!res.ok) throw new Error(`No KanjiVG data for ${char} (${hex}.svg)`);
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');

  const strokeId = new RegExp(`^kvg:${hex}-s(\\d+)$`);
  const paths = [...doc.querySelectorAll('path')]
    .map((p) => ({ el: p, m: strokeId.exec(p.getAttribute('id') || '') }))
    .filter((p) => p.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((p) => p.el.getAttribute('d'));

  return { char, strokes: paths.map((d) => ({ d, points: samplePath(d) })) };
}

// Let the browser do the curve math: put the path in a hidden SVG and ask for
// points along it. (Safari needs the SVG attached to the page for this.)
function samplePath(d) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const len = path.getTotalLength();
  const points = [];
  for (let i = 0; i < POINTS_PER_PATH; i++) {
    const p = path.getPointAtLength((len * i) / (POINTS_PER_PATH - 1));
    points.push({ x: p.x, y: p.y });
  }
  svg.remove();
  return points;
}
