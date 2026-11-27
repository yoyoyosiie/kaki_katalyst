// All the grading knobs live here, so you can tune how strict the app is
// without touching the matching logic.
//
// Units: everything is measured in KanjiVG's coordinate box, which is
// 109 x 109 units for the whole character. So a tolerance of 10 means
// "about 9% of the character's width".

export const BOX_SIZE = 109;

export const SETTINGS = {
  // Every stroke (yours and the model's) is resampled to this many evenly
  // spaced points before comparing. More points = smoother comparison,
  // slightly more work. 32 is plenty for a single stroke.
  SAMPLE_POINTS: 32,

  // Strokes shorter than this are treated as accidental taps and ignored.
  MIN_STROKE_LENGTH: 2,

  // Before grading, drawn points closer together than this are dropped.
  // Removes pen sensor jitter that otherwise inflates stroke length.
  MIN_POINT_SPACING: 1.5,

  // Model strokes shorter than this (dots, ticks) skip the direction and
  // length checks, because a tiny wobble flips their direction completely.
  SHORT_STROKE_LENGTH: 15,

  // After this many failed attempts on the same stroke, show a hint.
  HINT_AFTER_FAILS: 2,

  // In sentences, kanji boxes always block (a wrong stroke must be redone).
  // Kana boxes are feedback-only: mistakes are kept and shown on Check.
  // Set this to true to make kana block too.
  KANA_BLOCKS: false,

  // How many times you trace a new kanji before writing it freehand.
  TRACE_REPEATS: 3,

  // Your stroke's length must be within this ratio of the model's length.
  LENGTH_RATIO_MIN: 0.4,
  LENGTH_RATIO_MAX: 2.0,

  // Per-mode tolerances. Tracing has a guide to follow, so it is stricter.
  modes: {
    trace: {
      // Mean distance between matching points of your stroke and the model.
      MAX_AVG_DISTANCE: 12,
      // How far your start and end points may be from the model's.
      MAX_ENDPOINT_DISTANCE: 20,
      // Average cosine similarity of segment directions (1 = identical,
      // 0 = perpendicular, -1 = opposite).
      MIN_DIRECTION_SIMILARITY: 0.55,
    },
    freehand: {
      MAX_AVG_DISTANCE: 18,
      MAX_ENDPOINT_DISTANCE: 26,
      MIN_DIRECTION_SIMILARITY: 0.5,
    },
    // Sentence boxes are much smaller than the big box, so the same
    // wobble of your hand is a bigger fraction of the character.
    'sentence-trace': {
      MAX_AVG_DISTANCE: 16,
      MAX_ENDPOINT_DISTANCE: 25,
      MIN_DIRECTION_SIMILARITY: 0.45,
    },
    'sentence-freehand': {
      MAX_AVG_DISTANCE: 22,
      MAX_ENDPOINT_DISTANCE: 32,
      MIN_DIRECTION_SIMILARITY: 0.4,
    },
  },
};
