// Step 1 test page: practise one kanji in trace or freehand mode.
// Wires the InkPad (input + drawing) to the matcher (grading).

import { SETTINGS } from './config.js';
import { loadKanji } from './kanjivg.js';
import { InkPad } from './inkpad.js';
import { checkStroke, scoreCharacter } from './matcher.js';

const $ = (id) => document.getElementById(id);

const state = {
  kanji: null, // { char, strokes }
  mode: 'trace', // 'trace' | 'freehand'
  index: 0, // stroke being drawn now
  fails: 0, // failed tries on the current stroke
  attempts: [], // per finished stroke: { tries, avgDistance }
};

const pad = new InkPad($('pad'), { onStrokeEnd });

function reasonText(result, n) {
  switch (result.reason) {
    case 'backwards': return `Stroke ${n} goes the other way.`;
    case 'wrong-order': return `That was stroke ${result.matchedIndex + 1}. Stroke ${n} comes first.`;
    case 'length': return `Stroke ${n} is too long or too short.`;
    case 'shape': return `Stroke ${n}'s shape is off.`;
    default: return `Stroke ${n} isn't in the right place.`;
  }
}

function onStrokeEnd(points) {
  const { kanji } = state;
  if (!kanji || state.index >= kanji.strokes.length) return;

  const models = kanji.strokes.map((s) => s.points);
  const n = state.index + 1;
  const result = checkStroke(points, models, state.index, state.mode);

  if (!result.pass) {
    state.fails++;
    pad.reject(points);
    let msg = reasonText(result, n);
    if (state.fails >= SETTINGS.HINT_AFTER_FAILS) {
      pad.showHint(state.index);
      msg += ' Follow the orange stroke from the dot.';
    }
    setStatus(msg, 'bad');
    return;
  }

  state.attempts.push({ tries: state.fails + 1, avgDistance: result.avgDistance });
  state.index++;
  state.fails = 0;
  pad.showHint(-1);
  pad.accept(points);

  if (state.index === kanji.strokes.length) finish();
  else setStatus(`Stroke ${n} ✓  Next: stroke ${state.index + 1} of ${kanji.strokes.length}.`, 'good');
}

function finish() {
  const s = scoreCharacter(state.attempts, state.mode);
  setStatus('Done!', 'good');
  $('result').hidden = false;
  $('result').innerHTML =
    `<strong>${state.kanji.char}</strong> complete<br>` +
    `Stroke order: ${s.firstTry} of ${s.total} right first try<br>` +
    `Shape accuracy: ${s.shapeAccuracy}%`;
}

function setStatus(text, tone = '') {
  const el = $('status');
  el.textContent = text;
  el.dataset.tone = tone;
}

function restart() {
  state.index = 0;
  state.fails = 0;
  state.attempts = [];
  $('result').hidden = true;
  pad.reset();
  pad.setGuide(state.kanji.strokes, state.mode === 'trace');
  const verb = state.mode === 'trace' ? 'Trace' : 'Write';
  setStatus(`${verb} ${state.kanji.char}: ${state.kanji.strokes.length} strokes. Start with stroke 1.`);
}

async function selectKanji(char) {
  setStatus('Loading…');
  try {
    state.kanji = await loadKanji(char);
    restart();
  } catch (err) {
    setStatus(err.message, 'bad');
  }
}

function selectMode(mode) {
  state.mode = mode;
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
  if (state.kanji) restart();
}

$('kanji').addEventListener('change', (e) => selectKanji(e.target.value));
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => selectMode(b.dataset.mode));
}
$('restart').addEventListener('click', restart);
$('hint').addEventListener('click', () => {
  if (state.kanji && state.index < state.kanji.strokes.length) pad.showHint(state.index);
});

// Handy for automated tests and for poking at things in the console.
window.kakiApp = { state, pad };

selectMode('trace');
selectKanji($('kanji').value);
