// Small, pure geometry helpers for comparing strokes.
// A "point" is {x, y}. A "stroke" is an array of points in drawing order.
// Nothing here touches the DOM, so it runs (and is tested) in Node too.

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Total length of the polyline through all the points.
export function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

// Resample a stroke to `count` points spaced evenly along its length.
//
// Why: you and the model draw at different speeds, so raw points don't line
// up (a slow start packs many points near the beginning). After resampling,
// point i of your stroke and point i of the model are both "i/(count-1) of
// the way along the stroke", so comparing them pairwise is fair.
export function resample(points, count) {
  if (points.length === 0) return [];
  const total = strokeLength(points);
  if (points.length === 1 || total === 0) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  const step = total / (count - 1);
  const out = [{ ...points[0] }];
  let carried = 0; // distance walked since the last output point
  let prev = points[0];

  for (let i = 1; i < points.length && out.length < count; i++) {
    let next = points[i];
    let seg = distance(prev, next);
    // One input segment may contain several output points.
    while (carried + seg >= step && out.length < count) {
      const t = (step - carried) / seg;
      const p = { x: prev.x + t * (next.x - prev.x), y: prev.y + t * (next.y - prev.y) };
      out.push(p);
      prev = p;
      seg = distance(prev, next);
      carried = 0;
    }
    carried += seg;
    prev = next;
  }
  // Floating-point rounding can leave us one short; finish on the last point.
  while (out.length < count) out.push({ ...points[points.length - 1] });
  return out;
}

// Mean distance between corresponding points of two equal-length strokes.
export function averageDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += distance(a[i], b[i]);
  return sum / a.length;
}

// Average cosine similarity between corresponding segment directions.
// 1 means every little piece of your stroke points the same way as the
// model's; -1 means you drew it backwards.
export function directionSimilarity(a, b) {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < a.length; i++) {
    const ax = a[i].x - a[i - 1].x, ay = a[i].y - a[i - 1].y;
    const bx = b[i].x - b[i - 1].x, by = b[i].y - b[i - 1].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la === 0 || lb === 0) continue;
    sum += (ax * bx + ay * by) / (la * lb);
    n++;
  }
  return n === 0 ? 1 : sum / n;
}
