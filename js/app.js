// The lesson flow for one new kanji:
//   Trace ×3 → Freehand → Trace sentence → Write sentence
// Each step must be finished before Next appears.

import { SETTINGS } from './config.js';
import { loadKanji } from './kanjivg.js';
import { InkPad } from './inkpad.js';
import { CharSession, reasonText } from './session.js';
import { parseFurigana, writingBoxes, isKanji } from './furigana.js';
import { getCovered, markCovered, getImportedLessons, saveImportedLessons } from './progress.js';
import { SAMPLE_LESSONS } from './lessons.js';
import { lessonsFromExport } from './deck.js';

// Your imported Kaishi lessons if there are any, otherwise the samples.
let LESSONS = getImportedLessons() || SAMPLE_LESSONS;

const $ = (id) => document.getElementById(id);

const STAGES = [
  ...Array.from({ length: SETTINGS.TRACE_REPEATS }, (_, i) => (
    { kind: 'single', mode: 'trace', label: `Trace ${i + 1}` })),
  { kind: 'single', mode: 'freehand', label: 'Freehand' },
  { kind: 'sentence', mode: 'trace', label: 'Trace sentence' },
  { kind: 'sentence', mode: 'freehand', label: 'Write sentence' },
];

const state = {
  lesson: null, // entry from LESSONS
  stage: 0, // index into STAGES
  session: null, // CharSession for single-kanji steps
  boxes: [], // sentence steps: [{ char, hidden, segment, session, pad, el }]
  covered: getCovered(),
};

// ---- debug readout (?debug=1) -------------------------------------------

const DEBUG = new URLSearchParams(location.search).has('debug');
$('debug').hidden = !DEBUG;

function showDebug(result, n, mode, info) {
  if (!DEBUG || !result) return;
  const m = result.metrics;
  const tol = SETTINGS.modes[mode];
  const f = (v) => v.toFixed(2);
  const row = (label, value, limit, ok) =>
    `<tr class="${ok ? '' : 'over'}"><td>${label}</td><td>${value}</td><td>${limit}</td></tr>`;
  const lenOk = m.isShort || (m.lengthRatio >= SETTINGS.LENGTH_RATIO_MIN && m.lengthRatio <= SETTINGS.LENGTH_RATIO_MAX);
  $('debug').innerHTML =
    `<p>Stroke ${n} · ${mode} · ${info.pointerType} · ${result.reason}` +
    `${m.isShort ? ' · short stroke' : ''}<br>points: ${m.rawPoints} raw → ${m.keptPoints} kept</p>` +
    '<table><tr><th>check</th><th>yours</th><th>limit</th></tr>' +
    row('start offset', f(m.startOffset), `≤ ${tol.MAX_ENDPOINT_DISTANCE}`, m.startOffset <= tol.MAX_ENDPOINT_DISTANCE) +
    row('end offset', f(m.endOffset), `≤ ${tol.MAX_ENDPOINT_DISTANCE}`, m.endOffset <= tol.MAX_ENDPOINT_DISTANCE) +
    row('avg distance', f(m.avgDistance), `≤ ${tol.MAX_AVG_DISTANCE}`, m.avgDistance <= tol.MAX_AVG_DISTANCE) +
    row('length ratio', f(m.lengthRatio), `${SETTINGS.LENGTH_RATIO_MIN}–${SETTINGS.LENGTH_RATIO_MAX}`, lenOk) +
    row('direction', f(m.direction), `≥ ${tol.MIN_DIRECTION_SIMILARITY}`, m.isShort || m.direction >= tol.MIN_DIRECTION_SIMILARITY) +
    '</table>';
}

// ---- small UI helpers -----------------------------------------------------

function setStatus(text, tone = '') {
  $('status').textContent = text;
  $('status').dataset.tone = tone;
}

function showNext(label = 'Next') {
  $('next').textContent = label;
  $('next').hidden = false;
}

function renderStages() {
  $('stages').innerHTML = STAGES.map((s, i) => {
    const cls = i < state.stage ? 'done' : i === state.stage ? 'current' : '';
    return `<li class="${cls}">${s.label}</li>`;
  }).join('');
}

function renderLessonPicker() {
  $('lesson').innerHTML = LESSONS.map((l, i) =>
    `<option value="${i}">${i + 1}. ${l.kanji}${l.word ? ` (${l.word})` : ''}` +
    `${state.covered.has(l.kanji) ? ' ✓' : ''}</option>`).join('');
  if (state.lesson) $('lesson').value = String(LESSONS.indexOf(state.lesson));
}

// ---- single-kanji steps (trace ×3, freehand) ------------------------------

const pad = new InkPad($('pad'), { onStrokeEnd: onSingleStroke });

async function startSingle(stage) {
  const kanji = await loadKanji(state.lesson.kanji);
  state.session = new CharSession({
    char: kanji.char, strokes: kanji.strokes, mode: stage.mode, blocking: true,
  });
  pad.locked = false;
  pad.reset();
  pad.setGuide(kanji.strokes, stage.mode === 'trace');
  const verb = stage.mode === 'trace' ? 'Trace' : 'Write';
  setStatus(`${verb} ${kanji.char}: ${kanji.strokes.length} strokes. Start with stroke 1.`);
}

function onSingleStroke(points, info) {
  const s = state.session;
  if (!s) return;
  const n = s.index + 1;
  const out = s.handle(points);
  showDebug(out.result, n, s.mode, info);

  if (out.action === 'reject') {
    pad.reject(points);
    if (out.hint) pad.showHint(s.index);
    setStatus(reasonText(out.result, n) + (out.hint ? ' Follow the orange stroke from the dot.' : ''), 'bad');
    return;
  }
  if (out.action !== 'accept') return;

  pad.showHint(-1);
  pad.accept(points);
  if (!s.done) {
    setStatus(`Stroke ${n} ✓  Next: stroke ${s.index + 1} of ${s.total}.`, 'good');
    return;
  }
  const sc = s.score();
  pad.locked = true;
  setStatus('Done!', 'good');
  $('result').hidden = false;
  $('result').innerHTML =
    `Stroke order: ${sc.firstTry} of ${sc.total} right first try<br>Shape accuracy: ${sc.shapeAccuracy}%`;
  showNext();
}

$('hint').addEventListener('click', () => {
  const s = state.session;
  if (s && !s.done) pad.showHint(s.index);
});

// ---- sentence steps -------------------------------------------------------

// Kanji you know for this lesson: everything covered plus today's kanji.
function knownKanji() {
  return new Set([...state.covered, state.lesson.kanji]);
}

async function startSentence(stage) {
  const segments = parseFurigana(state.lesson.sentence);
  const layout = writingBoxes(segments, knownKanji());
  state.segments = segments;
  $('answer').hidden = true;
  $('check').hidden = false;

  // What to write. Tracing has the outline in each box. Writing freehand
  // shows the whole sentence in kana: words you should write in kanji are
  // highlighted (as are their boxes), so the prompt doesn't give the kanji away.
  const hiddenSegs = new Set(layout.filter((b) => b.hidden).map((b) => b.segment));
  const promptText = segments.map((seg, i) => {
    if (!seg.reading) return seg.text;
    if (hiddenSegs.has(i)) return seg.reading;
    return `<mark>${seg.reading}</mark>`; // write this in kanji
  }).join('');
  $('prompt').innerHTML = stage.mode === 'trace'
    ? `${state.lesson.english}`
    : `<span class="jp">${promptText}</span><br>Write the <mark>highlighted</mark> words in kanji. ${state.lesson.english}`;

  const container = $('boxes');
  container.innerHTML = '';
  container.style.setProperty('--n', String(layout.length));

  state.boxes = await Promise.all(layout.map(async (b, i) => {
    const el = document.createElement('div');
    el.className = 'box';
    if (b.hidden) el.classList.add('hidden-kanji');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `Box ${i + 1}`);
    el.appendChild(canvas);
    container.appendChild(el);

    const box = { ...b, el, session: null, pad: null };
    let kanji = null;
    if (!b.given) {
      try { kanji = await loadKanji(b.char); } catch { /* no stroke data */ }
    }
    box.pad = new InkPad(canvas, { onStrokeEnd: (pts, info) => onBoxStroke(box, i, pts, info) });
    if (!kanji || b.given) {
      // No stroke data, or a kanji you haven't learned that the deck gave no
      // reading for: print the character and don't grade it.
      el.classList.add('printed');
      el.dataset.char = b.char;
      box.pad.locked = true;
      return box;
    }
    box.session = new CharSession({
      char: b.char,
      strokes: kanji.strokes,
      mode: `sentence-${stage.mode}`, // looser tolerances for small boxes
      blocking: isKanji(b.char) || SETTINGS.KANA_BLOCKS,
    });
    if (box.session.blocking) el.classList.add('blocking');
    if (isKanji(b.char)) box.pad.paper = '#fbe3c4'; // matches --highlight in CSS
    box.pad.setGuide(kanji.strokes, stage.mode === 'trace');
    return box;
  }));

  setStatus(stage.mode === 'trace'
    ? 'Trace each box, then press Check. Kanji boxes must be right to continue.'
    : 'Write each box, then press Check. Kanji boxes must be right to continue.');
}

function onBoxStroke(box, i, points, info) {
  const s = box.session;
  if (!s) return;
  const n = s.index + 1;
  const out = s.handle(points);
  showDebug(out.result, n, s.mode, info);

  if (out.action === 'reject') {
    box.pad.reject(points);
    if (out.hint) box.pad.showHint(s.index);
    setStatus(`Box ${i + 1} (${box.char}): ${reasonText(out.result, n)}`, 'bad');
    return;
  }
  if (out.action === 'accept' || out.action === 'mistake') {
    box.pad.showHint(-1);
    box.pad.accept(points);
    if (s.done) box.el.classList.add('complete');
  }
}

function checkSentence() {
  const graded = state.boxes.filter((b) => b.session);
  const unfinished = graded.filter((b) => b.session.blocking && !b.session.done);

  for (const b of graded) {
    b.el.classList.remove('error', 'ok', 'needs');
    if (b.session.blocking && !b.session.done) b.el.classList.add('needs');
    else b.el.classList.add(b.session.hasErrors ? 'error' : 'ok');
  }

  // Reveal the real sentence. Words you wrote in hiragana are highlighted,
  // with their kanji form and reading.
  $('answer').hidden = false;
  $('answer').innerHTML = state.segments.map((seg, i) => {
    const hidden = state.boxes.some((b) => b.hidden && b.segment === i);
    const ruby = seg.reading ? `<ruby>${seg.text}<rt>${seg.reading}</rt></ruby>` : seg.text;
    return hidden ? `<mark>${ruby}</mark>` : ruby;
  }).join('');

  if (unfinished.length) {
    setStatus(`Finish the kanji boxes first: ${unfinished.map((b) => b.char).join(' ')}`, 'bad');
    return;
  }
  const mistakes = graded.filter((b) => b.session.hasErrors).length;
  setStatus(mistakes
    ? `Done. ${mistakes} box${mistakes > 1 ? 'es have' : ' has'} mistakes (marked in red). They don't block you.`
    : 'Done. Everything correct!', mistakes ? '' : 'good');
  for (const b of state.boxes) b.pad.locked = true;
  $('check').hidden = true;
  showNext(state.stage === STAGES.length - 1 ? 'Finish lesson' : 'Next');
}

$('check').addEventListener('click', checkSentence);

// ---- flow -----------------------------------------------------------------

async function startStage() {
  const stage = STAGES[state.stage];
  $('next').hidden = true;
  $('result').hidden = true;
  $('single').hidden = stage.kind !== 'single';
  $('sentence').hidden = stage.kind !== 'sentence';
  $('hint').hidden = stage.kind !== 'single';
  $('check').hidden = stage.kind !== 'sentence';
  document.body.className = `stage-${stage.kind}`;
  renderStages();
  setStatus('Loading…');
  try {
    if (stage.kind === 'single') await startSingle(stage);
    else await startSentence(stage);
  } catch (err) {
    setStatus(err.message, 'bad');
  }
}

function finishLesson() {
  state.covered = markCovered(state.lesson.kanji);
  renderLessonPicker();
  state.stage = STAGES.length; // all done
  renderStages();
  $('single').hidden = true;
  $('sentence').hidden = true;
  $('hint').hidden = true;
  $('check').hidden = true;
  document.body.className = '';
  const nextIndex = LESSONS.indexOf(state.lesson) + 1;
  setStatus(`${state.lesson.kanji} learned!`, 'good');
  if (nextIndex < LESSONS.length) showNext(`Next lesson: ${LESSONS[nextIndex].kanji}`);
}

$('next').addEventListener('click', () => {
  if (state.stage >= STAGES.length) {
    const nextIndex = LESSONS.indexOf(state.lesson) + 1;
    if (nextIndex < LESSONS.length) startLesson(nextIndex);
  } else if (state.stage === STAGES.length - 1) {
    finishLesson();
  } else {
    state.stage++;
    startStage();
  }
});

$('restart').addEventListener('click', () => {
  if (state.stage < STAGES.length) startStage();
  else startLesson(LESSONS.indexOf(state.lesson));
});

$('lesson').addEventListener('change', (e) => startLesson(Number(e.target.value)));

// ---- importing the deck -----------------------------------------------------

$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // allow re-importing the same file
  if (!file) return;
  try {
    const { lessons, notes } = lessonsFromExport(await file.text());
    if (!lessons.length) throw new Error('No kanji found in that file.');
    LESSONS = lessons;
    const saved = saveImportedLessons(lessons);
    renderLessonPicker();
    await startLesson(firstUncovered());
    setStatus(`Imported ${lessons.length} kanji lessons from ${notes} cards.` +
      (saved ? '' : ' (This browser won\'t save them; you\'ll need to import again next time.)'), 'good');
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, 'bad');
  }
});

function firstUncovered() {
  const i = LESSONS.findIndex((l) => !state.covered.has(l.kanji));
  return i === -1 ? 0 : i;
}

function startLesson(index) {
  state.lesson = LESSONS[index];
  state.stage = 0;
  $('lesson').value = String(index);
  return startStage();
}

// Handy for automated tests and for poking at things in the console.
window.kakiApp = { state, pad, STAGES };

renderLessonPicker();
startLesson(firstUncovered()).then(() => { // the first lesson you haven't finished
  if (LESSONS === SAMPLE_LESSONS) {
    setStatus('Sample lessons. Press "Import deck" to load your Kaishi 1.5k export.');
  }
});
