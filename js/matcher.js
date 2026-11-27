// Decides whether a stroke you drew matches the stroke you were supposed to
// draw, and if not, why. Pure logic: no DOM, so it's unit-tested in Node.

import { SETTINGS } from './config.js';
import {
  distance, strokeLength, resample, averageDistance, directionSimilarity,
} from './geometry.js';

// Compare one drawn stroke against one model stroke.
// `drawn` and `model` are arrays of {x, y} in KanjiVG box units.
// Returns { pass, reason, avgDistance }.
//   reason is one of: 'ok', 'backwards', 'position', 'shape', 'length'
export function compareStroke(drawn, model, mode = 'trace') {
  const tol = SETTINGS.modes[mode];
  const n = SETTINGS.SAMPLE_POINTS;
  const a = resample(drawn, n);
  const b = resample(model, n);

  const modelLen = strokeLength(model);
  const drawnLen = strokeLength(drawn);
  const isShort = modelLen < SETTINGS.SHORT_STROKE_LENGTH;
  const avgDistance = averageDistance(a, b);

  // 1. Direction. Checked first because a backwards stroke would otherwise
  //    show up as a confusing "wrong position" error.
  //    Compare start->start + end->end against start->end + end->start.
  if (!isShort) {
    const forward = distance(a[0], b[0]) + distance(a[n - 1], b[n - 1]);
    const reversed = distance(a[0], b[n - 1]) + distance(a[n - 1], b[0]);
    if (reversed < forward) return { pass: false, reason: 'backwards', avgDistance };
  }

  // 2. Start and end in the right places.
  const startOff = distance(a[0], b[0]);
  const endOff = distance(a[n - 1], b[n - 1]);
  if (startOff > tol.MAX_ENDPOINT_DISTANCE || endOff > tol.MAX_ENDPOINT_DISTANCE) {
    return { pass: false, reason: 'position', avgDistance };
  }

  // 3. Overall closeness along the whole stroke.
  if (avgDistance > tol.MAX_AVG_DISTANCE) {
    return { pass: false, reason: 'position', avgDistance };
  }

  if (!isShort) {
    // 4. Length: catches strokes that start and end right but take a
    //    big detour, or are cut short.
    const ratio = drawnLen / modelLen;
    if (ratio < SETTINGS.LENGTH_RATIO_MIN || ratio > SETTINGS.LENGTH_RATIO_MAX) {
      return { pass: false, reason: 'length', avgDistance };
    }
    // 5. Shape: each small piece should point the same way as the model.
    if (directionSimilarity(a, b) < tol.MIN_DIRECTION_SIMILARITY) {
      return { pass: false, reason: 'shape', avgDistance };
    }
  }

  return { pass: true, reason: 'ok', avgDistance };
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
      return { pass: false, reason: 'wrong-order', avgDistance: result.avgDistance, matchedIndex: j };
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
