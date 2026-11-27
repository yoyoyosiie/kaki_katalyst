// The writing surface: takes pen input and draws everything on one canvas.
//
// Input uses Pointer Events, which treat Apple Pencil, Android styluses,
// fingers and mice the same way. Two rules make it pen-friendly:
//   1. Palm rejection: once a pen has been seen, finger touches are ignored.
//   2. Only one pointer draws at a time.
//
// Everything is drawn in KanjiVG box units (0..109), and the canvas is
// scaled to whatever size it is on screen.

import { BOX_SIZE, SETTINGS } from './config.js';
import { strokeLength } from './geometry.js';

const COLORS = {
  paper: '#fffdf8',
  grid: '#d9cfc0',
  gridCenter: '#e8e0d3',
  ghost: '#ddd6cb',
  ink: '#1f1b16',
  rejected: '#d64545',
  hint: '#e0892b',
};

// Shared by every pad on the page: once a pen touches any of them, finger
// touches are ignored everywhere (your palm rests across several boxes).
let penSeen = false;

export class InkPad {
  constructor(canvas, { onStrokeEnd }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStrokeEnd = onStrokeEnd;

    this.guideStrokes = []; // [{d}] KanjiVG paths
    this.showGhost = false; // draw the gray outline to trace over
    this.hintIndex = -1; // stroke to highlight, or -1
    this.inked = []; // accepted strokes: arrays of points
    this.rejected = null; // { points, until } briefly shown in red
    this.current = null; // stroke being drawn right now

    this.activePointer = null;
    this.locked = false; // true = ignore all input

    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  // ---- public API -------------------------------------------------------

  setGuide(strokes, showGhost) {
    this.guideStrokes = strokes;
    this.showGhost = showGhost;
    this.render();
  }

  reset() {
    this.inked = [];
    this.rejected = null;
    this.current = null;
    this.hintIndex = -1;
    this.render();
  }

  accept(points) {
    this.inked.push(points);
    this.render();
  }

  reject(points) {
    this.rejected = { points, until: performance.now() + 700 };
    this.render();
    setTimeout(() => this.render(), 750);
  }

  showHint(index) {
    this.hintIndex = index;
    this.render();
  }

  // ---- input --------------------------------------------------------------

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    // iOS: stop long-press magnifier / callout and scrolling while writing.
    c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  ignore(e) {
    if (e.pointerType === 'pen') penSeen = true;
    return this.locked || (penSeen && e.pointerType === 'touch');
  }

  onDown(e) {
    if (this.ignore(e) || this.activePointer !== null) return;
    e.preventDefault();
    this.activePointer = e.pointerId;
    this.activeType = e.pointerType;
    // Keep receiving moves even if the pen slides off the canvas edge.
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    this.current = [this.toBox(e)];
    this.render();
  }

  onMove(e) {
    if (e.pointerId !== this.activePointer) return;
    // Pens report more positions than the screen refresh rate; coalesced
    // events give us all of them, which makes curves smoother.
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) this.current.push(this.toBox(ev));
    this.render();
  }

  onUp(e) {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    const points = this.current;
    this.current = null;
    this.render();
    if (points && strokeLength(points) >= SETTINGS.MIN_STROKE_LENGTH) {
      this.onStrokeEnd(points, { pointerType: this.activeType });
    }
  }

  // Screen position -> KanjiVG box units.
  toBox(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * BOX_SIZE,
      y: ((e.clientY - r.top) / r.height) * BOX_SIZE,
    };
  }

  // ---- drawing ------------------------------------------------------------

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const size = this.canvas.clientWidth;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    const scale = canvas.width / BOX_SIZE;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, BOX_SIZE, BOX_SIZE);
    this.drawGrid();

    if (this.showGhost) {
      for (const s of this.guideStrokes) this.drawPath(s.d, COLORS.ghost, 4);
    }
    if (this.hintIndex >= 0 && this.guideStrokes[this.hintIndex]) {
      const s = this.guideStrokes[this.hintIndex];
      this.drawPath(s.d, COLORS.hint, 4);
      const start = s.points[0];
      ctx.fillStyle = COLORS.hint;
      ctx.beginPath();
      ctx.arc(start.x, start.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const pts of this.inked) this.drawPoints(pts, COLORS.ink, 3.6);
    if (this.rejected && performance.now() < this.rejected.until) {
      this.drawPoints(this.rejected.points, COLORS.rejected, 3.6);
    }
    if (this.current) this.drawPoints(this.current, COLORS.ink, 3.6);
  }

  // 田-style guide: outer border plus dashed center lines.
  drawGrid() {
    const { ctx } = this;
    const m = BOX_SIZE / 2;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([]);
    ctx.strokeRect(0.4, 0.4, BOX_SIZE - 0.8, BOX_SIZE - 0.8);
    ctx.strokeStyle = COLORS.gridCenter;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(m, 0); ctx.lineTo(m, BOX_SIZE);
    ctx.moveTo(0, m); ctx.lineTo(BOX_SIZE, m);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPath(d, color, width) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.stroke(new Path2D(d));
  }

  drawPoints(points, color, width) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}
