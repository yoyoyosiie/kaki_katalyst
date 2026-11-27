// Decides whether a stroke you drew matches the stroke you were supposed to
// draw, and if not, why. Pure logic: no DOM, so it's unit-tested in Node.

import { SETTINGS } from './config.js';
import {
  distance, strokeLength, resample, averageDistance, directionSimilarity, simplify,
} from './geometry.js';

// Compare one drawn stroke against one model stroke.
// `drawn` and `model` are arrays of {x, y} in KanjiVG box units.
// Returns { pass, reason, avgDistance, metrics }.
//   reason is one of: 'ok', 'backwards', 'position', 'shape', 'length'
//   metrics holds every measured number (shown by the ?debug=1 readout).
export function compareStroke(drawn, model, mode = 'trace') {
  const tol = SETTINGS.modes[mode];
  const n = SETTINGS.SAMPLE_POINTS;
  const cleaned = simplify(drawn, SETTINGS.MIN_POINT_SPACING);
  const a = resample(cleaned, n);
  const b = resample(model, n);

  const modelLen = strokeLength(model);
  const isShort = modelLen < SETTINGS.SHORT_STROKE_LENGTH;
  const metrics = {
    rawPoints: drawn.length,
    keptPoints: cleaned.length,
    lengthRatio: strokeLength(cleaned) / modelLen,
    startOffset: distance(a[0], b[0]),
    endOffset: distance(a[n - 1], b[n - 1]),
    avgDistance: averageDistance(a, b),
    direction: directionSimilarity(a, b),
    isShort,
  };
  const fail = (reason) => ({ pass: false, reason, avgDistance: metrics.avgDistance, metrics });

  // 1. Direction. Checked first because a backwards stroke would otherwise
  //    show up as a confusing "wrong position" error.
  //    Compare start->start + end->end against start->end + end->start.
  if (!isShort) {
    const reversed = distance(a[0], b[n - 1]) + distance(a[n - 1], b[0]);
    if (reversed < metrics.startOffset + metrics.endOffset) return fail('backwards');
  }

  // 2. Start and end in the right places.
  if (metrics.startOffset > tol.MAX_ENDPOINT_DISTANCE || metrics.endOffset > tol.MAX_ENDPOINT_DISTANCE) {
    return fail('position');
  }

  // 3. Overall closeness along the whole stroke.
  if (metrics.avgDistance > tol.MAX_AVG_DISTANCE) return fail('position');

  if (!isShort) {
    // 4. Length: catches strokes that start and end right but take a
    //    big detour, or are cut short.
    if (metrics.lengthRatio < SETTINGS.LENGTH_RATIO_MIN || metrics.lengthRatio > SETTINGS.LENGTH_RATIO_MAX) {
      return fail('length');
    }
    // 5. Shape: each small piece should point the same way as the model.
    if (metrics.direction < tol.MIN_DIRECTION_SIMILARITY) return fail('shape');
  }

  return { pass: true, reason: 'ok', avgDistance: metrics.avgDistance, metrics };
}

// Check a drawn stroke given where you are in the character.
// `modelStrokes` is the full list (in correct order); `expectedIndex` is the
// stroke you should be drawing now.
// Returns { pass, reason, avgDistance, matchedIndex }.
//   Extra reason: 'wrong-order' when it matches a later stroke instead.
export function checkStroke(drawn, modelStrokes, expectedIndex, mode = 'trace') {
  const result = compareStroke(drawn, modelStrokes[expectedIndex], mode);
  if (result.pass) return { ...result, matchedIndex: expectedIndex };

  // Did they draw a different (later) stroke of the same kanji instead?
  // If so, that's a stroke-order mistake, not a shape mistake.
  for (let j = expectedIndex + 1; j < modelStrokes.length; j++) {
    if (compareStroke(drawn, modelStrokes[j], mode).pass) {
      return { ...result, pass: false, reason: 'wrong-order', matchedIndex: j };
    }
  }
  return { ...result, matchedIndex: -1 };
}

// Summarise a finished character.
// `attempts` is one entry per model stroke: { tries, avgDistance }.
export function scoreCharacter(attempts, mode = 'trace') {
  const total = attempts.length;
  const firstTry = attempts.filter((s) => s.tries === 1).length;
  const maxDist = SETTINGS.modes[mode].MAX_AVG_DISTANCE;
  // Shape accuracy: 100% = perfectly on the model, 0% = right at the limit.
  const mean = attempts.reduce((sum, s) => sum + s.avgDistance, 0) / total;
  const shapeAccuracy = Math.round(100 * Math.max(0, 1 - mean / maxDist));
  return { total, firstTry, shapeAccuracy };
}
