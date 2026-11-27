// Tracks one character being written: which stroke is next, what went
// wrong, and whether a mistake blocks you.
//
//   blocking = true:  a wrong stroke is rejected and you redo it (target
//                     kanji and kanji you've covered).
//   blocking = false: a wrong stroke is kept, recorded as an error and
//                     shown when you press Check (everything else).
//
// Pure logic: the UI feeds it strokes and acts on what it returns.

import { SETTINGS } from './config.js';
import { checkStroke, scoreCharacter } from './matcher.js';

export class CharSession {
  constructor({ char, strokes, mode, blocking }) {
    this.char = char;
    this.models = strokes.map((s) => s.points);
    this.mode = mode;
    this.blocking = blocking;
    this.index = 0; // next stroke to draw
    this.fails = 0; // failed tries on the current stroke (blocking only)
    this.attempts = []; // per stroke: { tries, avgDistance }
    this.errors = []; // per wrong stroke (non-blocking): { stroke, reason }
  }

  get total() { return this.models.length; }
  get done() { return this.index >= this.total; }

  // Grade one drawn stroke. Returns { action, result, hint }:
  //   action 'accept'  -> correct, keep the ink
  //   action 'mistake' -> wrong but not blocking: keep the ink, move on
  //   action 'reject'  -> wrong and blocking: remove the ink, try again
  //   action 'ignore'  -> the character is already finished
  //   hint: true when the UI should show where the stroke goes
  handle(points) {
    if (this.done) return { action: 'ignore' };
    const result = checkStroke(points, this.models, this.index, this.mode);

    if (result.pass) {
      this.attempts.push({ tries: this.fails + 1, avgDistance: result.avgDistance });
      this.index++;
      this.fails = 0;
      return { action: 'accept', result, hint: false };
    }

    if (this.blocking) {
      this.fails++;
      return { action: 'reject', result, hint: this.fails >= SETTINGS.HINT_AFTER_FAILS };
    }

    this.errors.push({ stroke: this.index, reason: result.reason });
    this.attempts.push({ tries: 2, avgDistance: result.avgDistance });
    this.index++;
    return { action: 'mistake', result, hint: false };
  }

  // Has anything gone wrong (including strokes never written)?
  get hasErrors() { return this.errors.length > 0 || !this.done; }

  score() { return scoreCharacter(this.attempts, this.mode); }
}

// Human-readable reason for a failed stroke. `n` is the 1-based stroke number.
export function reasonText(result, n) {
  switch (result.reason) {
    case 'backwards': return `Stroke ${n} goes the other way.`;
    case 'wrong-order': return `That was stroke ${result.matchedIndex + 1}. Stroke ${n} comes first.`;
    case 'length': return `Stroke ${n} is too long or too short.`;
    case 'shape': return `Stroke ${n}'s shape is off.`;
    default: return `Stroke ${n} isn't in the right place.`;
  }
}
