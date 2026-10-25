import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Use the existing TypeScript dependency; no test framework or browser dependency.
const source = readFileSync(new URL('../src/audio.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2022 } }).outputText;
const { StudioAudio } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class Node {
  gain = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  Q = { value: 0 };
  starts = [];
  stops = [];
  disconnected = false;
  connect(node) { return node; }
  disconnect() { this.disconnected = true; }
  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); }
}

let context;
let tick;
let draw;
let cleared;
class Context {
  currentTime = 0;
  sampleRate = 48000;
  destination = new Node();
  sources = [];
  closed = false;
  resume = async () => {};
  constructor() { context = this; }
  createGain() { return new Node(); }
  createDynamicsCompressor() { return new Node(); }
  createBuffer() { return { getChannelData: () => new Float32Array(48000) }; }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  close() { this.closed = true; return Promise.resolve(); }
}
globalThis.AudioContext = Context;
globalThis.window = {
  setInterval(callback) { tick = callback; return 1; },
  clearInterval() { cleared = true; tick = undefined; },
};
globalThis.requestAnimationFrame = callback => { draw = callback; return 1; };
globalThis.cancelAnimationFrame = () => { draw = undefined; };
const empty = () => Array.from({ length: 5 }, () => Array(16).fill(false));

test('all five instruments produce finite, scheduled voices and dispose stops them', async () => {
  const engine = new StudioAudio();
  for (let i = 0; i < 5; i++) await engine.preview(i);
  assert.equal(context.sources.length, 8); // kick, snare x2, clap x3, hat, bass
  for (const node of context.sources) {
    assert.equal(node.starts.length, 1);
    assert.ok(Number.isFinite(node.stops[0]) && node.stops[0] > node.starts[0]);
  }
  engine.dispose();
  assert.equal(context.closed, true);
  assert.ok(context.sources.every(node => node.disconnected && node.stops.length === 2));
});

test('audio clock schedules selected steps, follows tempo changes, and stops the playhead', async () => {
  const engine = new StudioAudio();
  const pattern = empty();
  pattern[0][0] = pattern[0][1] = pattern[0][2] = true;
  let bpm = 120;
  const displayed = [];
  await engine.start(() => ({ pattern, bpm }), step => displayed.push(step));
  assert.equal(context.sources[0].starts[0], 0.04);
  context.currentTime = 0.08;
  tick(); // second sixteenth note at 0.165 (120 BPM)
  assert.ok(Math.abs(context.sources[1].starts[0] - 0.165) < 1e-9);
  bpm = 60;
  context.currentTime = 0.2;
  tick(); // third is already placed at .29; subsequent interval becomes .25
  assert.ok(Math.abs(context.sources[2].starts[0] - 0.29) < 1e-9);
  pattern[0][3] = true;
  context.currentTime = 0.46;
  tick();
  assert.ok(Math.abs(context.sources[3].starts[0] - 0.54) < 1e-9);
  draw();
  assert.equal(displayed.at(-1), 2);
  engine.stop();
  assert.equal(tick, undefined);
  assert.equal(draw, undefined);
  assert.equal(cleared, true);
});

test('stopping while audio permission is pending prevents a late start', async () => {
  const engine = new StudioAudio();
  let resolve;
  context.resume = () => new Promise(done => { resolve = done; });
  const pending = engine.start(() => ({ pattern: empty(), bpm: 120 }), () => {});
  engine.stop();
  resolve();
  await pending;
  assert.equal(tick, undefined);
  assert.equal(context.sources.length, 0);
});

test('background delays skip missed time rather than schedule a burst of past notes', async () => {
  const engine = new StudioAudio();
  const pattern = empty();
  pattern[0].fill(true);
  await engine.start(() => ({ pattern, bpm: 120 }), () => {});
  context.currentTime = 30;
  tick();
  assert.equal(context.sources.length, 2);
  assert.ok(context.sources[1].starts[0] >= 30);
  engine.dispose();
});
