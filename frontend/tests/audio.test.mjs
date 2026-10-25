import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Use the existing TypeScript dependency; no test framework or browser dependency.
const source = readFileSync(new URL('../src/audio.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2022 } }).outputText;
const { StudioAudio, bassFrequency, bassNotes, encodeWav, renderWav } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class Node {
  gain = { value: 1, targets: [], setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(value, time, smoothing) { this.value = value; this.targets.push({ value, time, smoothing }); } };
  frequency = { value: 0, setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime() {} };
  Q = { value: 0 };
  starts = [];
  stops = [];
  disconnected = false;
  connections = [];
  connect(node) { this.connections.push(node); return node; }
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

test('bass octave uses concert tuning with a semitone between each choice', () => {
  assert.equal(bassNotes.length, 12);
  assert.ok(Math.abs(bassFrequency('C2') - 65.406391) < 0.000001);
  assert.equal(bassFrequency('A2'), 110);
  assert.ok(Math.abs(bassFrequency('B2') - 123.470825) < 0.000001);
  for (let i = 1; i < bassNotes.length; i++) {
    assert.ok(Math.abs(bassFrequency(bassNotes[i]) / bassFrequency(bassNotes[i - 1]) - 2 ** (1 / 12)) < 1e-12);
  }
});

test('bass plays each enabled step at its chosen pitch and reads live pitch edits', async () => {
  const engine = new StudioAudio();
  const pattern = empty();
  pattern[4][0] = pattern[4][1] = pattern[4][3] = true;
  const notes = Array(16).fill('C2');
  notes[1] = 'G2';
  notes[2] = 'A2'; // Disabled step must remain silent.
  await engine.start(() => ({ pattern, bpm: 120, notes }), () => {});
  assert.ok(Math.abs(context.sources[0].frequency.value - 65.406391) < 0.000001);
  context.currentTime = 0.08;
  tick();
  assert.ok(Math.abs(context.sources[1].frequency.value - 97.998859) < 0.000001);
  context.currentTime = 0.2;
  tick();
  assert.equal(context.sources.length, 2);
  notes[3] = 'B2';
  context.currentTime = 0.33;
  tick();
  assert.ok(Math.abs(context.sources[2].frequency.value - 123.470825) < 0.000001);
  engine.dispose();
});

test('bass preview uses the selected pitch without starting playback', async () => {
  const engine = new StudioAudio();
  await engine.preview(4, 'A2');
  assert.equal(context.sources[0].frequency.value, 110);
  assert.equal(context.sources[0].type, 'triangle');
  assert.equal(tick, undefined);
  engine.dispose();
});

test('solo filters scheduled tracks, supports combinations and restores all tracks live', async () => {
  const engine = new StudioAudio();
  const pattern = empty();
  pattern[0].fill(true);
  pattern[4].fill(true);
  const original = JSON.stringify(pattern);
  let solos = [false, false, false, false, true];
  await engine.start(() => ({ pattern, bpm: 120, solos }), () => {});
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].type, 'triangle'); // Only bass.
  solos = [true, false, false, false, true];
  context.currentTime = 0.08;
  tick();
  assert.equal(context.sources.length, 3); // Kick + bass.
  solos = Array(5).fill(false);
  context.currentTime = 0.2;
  tick();
  assert.equal(context.sources.length, 5); // All enabled tracks restored.
  assert.equal(JSON.stringify(pattern), original);
  engine.dispose();
});

test('soloing an empty track stays silent and does not suppress manual previews', async () => {
  const engine = new StudioAudio();
  const pattern = empty();
  pattern[0][0] = true;
  await engine.start(() => ({ pattern, bpm: 120, solos: [false, false, false, true, false] }), () => {});
  assert.equal(context.sources.length, 0);
  await engine.preview(0);
  assert.equal(context.sources.length, 1);
  engine.dispose();
});

test('track volume routes both preview and playback through independent, live gain controls', async () => {
  const engine = new StudioAudio();
  engine.setVolumes([0.5, 1, 1, 1, 0.25]);
  await engine.preview(0);
  const kickBus = context.sources[0].connections[0].connections[0];
  assert.equal(kickBus.gain.value, 0.5);
  const pattern = empty();
  pattern[4][0] = true;
  await engine.start(() => ({ pattern, bpm: 120 }), () => {});
  const bassBus = context.sources[1].connections[0].connections[0];
  assert.notEqual(bassBus, kickBus);
  assert.equal(bassBus.gain.value, 0.25);
  engine.setVolumes([0, 1, 1, 1, 0.8]);
  assert.equal(kickBus.gain.value, 0);
  assert.equal(bassBus.gain.value, 0.8);
  assert.equal(bassBus.gain.targets.at(-1).smoothing, 0.01);
  engine.setVolumes([-1, 1, 1, 1, 2]);
  assert.equal(kickBus.gain.value, 0);
  assert.equal(bassBus.gain.value, 1);
  engine.dispose();
});

test('WAV encoding writes valid stereo PCM headers and interleaves clipped samples', () => {
  const data = [new Float32Array([1, -1, 2]), new Float32Array([0.5, -0.5, NaN])];
  const wav = encodeWav({ numberOfChannels: 2, length: 3, sampleRate: 44100, getChannelData: channel => data[channel] });
  const view = new DataView(wav);
  assert.equal(Buffer.from(wav).subarray(0, 4).toString(), 'RIFF');
  assert.equal(Buffer.from(wav).subarray(8, 12).toString(), 'WAVE');
  assert.equal(view.getUint32(4, true), wav.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 176400);
  assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 12);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true)), [32767, 16384, -32768, -16384, 32767, 0]);
});

test('offline export schedules four bars with bass pitches, volumes and a decay tail', async () => {
  class Offline extends Context {
    constructor(channels, length, rate) { super(); this.channels = channels; this.length = length; this.sampleRate = rate; }
    async startRendering() {
      return { numberOfChannels: this.channels, length: this.length, sampleRate: this.sampleRate, getChannelData: () => new Float32Array(this.length) };
    }
  }
  globalThis.OfflineAudioContext = Offline;
  const pattern = empty();
  pattern[0][0] = true;
  pattern[4][15] = true;
  const blob = await renderWav({ pattern, notes: Array(16).fill('A2'), volumes: [0.5, 1, 1, 1, 0.25], bpm: 120 });
  assert.equal(blob.type, 'audio/wav');
  assert.equal(context.length, Math.ceil(8.5 * 44100));
  assert.equal(blob.size, 44 + context.length * 4);
  assert.equal(context.sources.length, 8);
  assert.equal(context.sources[0].starts[0], 0);
  assert.equal(context.sources[7].starts[0], 7.875);
  assert.equal(context.sources[7].frequency.value, 110);
  assert.equal(context.sources[0].connections[0].connections[0].gain.value, 0.5);
  assert.equal(context.sources[7].connections[0].connections[0].gain.value, 0.25);
});

test('sample replaces synthesis in preview and playback; disabling restores synthesis', async () => {
  const engine = new StudioAudio();
  const buffer = { duration: 0.8 };
  engine.setSamples([{ name: 'kick.wav', buffer, enabled: true }]);
  await engine.preview(0);
  assert.equal(context.sources[0].buffer, buffer);
  const pattern = empty();
  pattern[0][0] = true;
  await engine.start(() => ({ pattern, bpm: 120 }), () => {});
  assert.equal(context.sources[1].buffer, buffer);
  engine.setSamples([{ name: 'kick.wav', buffer, enabled: false }]);
  await engine.preview(0);
  assert.equal(context.sources[2].buffer, undefined);
  engine.dispose();
});

test('WAV validation rejects wrong headers, long audio and multichannel samples', async () => {
  const engine = new StudioAudio();
  const wav = new TextEncoder().encode('RIFF0000WAVE').buffer;
  context.decodeAudioData = async () => ({ duration: 1, numberOfChannels: 2 });
  assert.equal((await engine.decodeSample(wav)).duration, 1);
  await assert.rejects(() => engine.decodeSample(new ArrayBuffer(12)), /WAV/);
  context.decodeAudioData = async () => ({ duration: 6, numberOfChannels: 1 });
  await assert.rejects(() => engine.decodeSample(wav), /5 sekunnin/);
  context.decodeAudioData = async () => ({ duration: 1, numberOfChannels: 6 });
  await assert.rejects(() => engine.decodeSample(wav), /mono/);
  engine.dispose();
});

test('AAAB playback changes only at bar boundaries and loops seamlessly back to A', async () => {
  const engine = new StudioAudio();
  const a = { pattern: empty(), notes: Array(16).fill('C2') };
  const b = { pattern: empty(), notes: Array(16).fill('A2') };
  a.pattern[0][0] = true;
  b.pattern[4][0] = true;
  const positions = [];
  await engine.start(() => ({ ...a, bpm: 120, clips: [a, b], sequence: [0, 0, 0, 1] }), (step, bar, clip) => { if (step === 0) positions.push([bar, clip]); });
  for (let i = 1; i <= 326; i++) { context.currentTime = i * 0.025; tick(); draw(); }
  assert.deepEqual(context.sources.map(node => Math.round(node.starts[0] * 100) / 100), [0.04, 2.04, 4.04, 6.04, 8.04]);
  assert.deepEqual(context.sources.map(node => node.type), ['sine', 'sine', 'sine', 'triangle', 'sine']);
  assert.equal(context.sources[3].frequency.value, 110);
  assert.deepEqual(positions, [[0, 0], [1, 0], [2, 0], [3, 1], [0, 0]]);
  engine.dispose();
});

test('arrangement WAV renders different clips in their assigned bars', async () => {
  const a = { pattern: empty(), notes: Array(16).fill('C2') };
  const b = { pattern: empty(), notes: Array(16).fill('A2') };
  a.pattern[0][0] = true;
  b.pattern[4][0] = true;
  await renderWav({ ...a, bpm: 120, volumes: Array(5).fill(1), clips: [a, b], sequence: [0, 0, 0, 1] });
  assert.deepEqual(context.sources.map(node => node.starts[0]), [0, 2, 4, 6]);
  assert.deepEqual(context.sources.map(node => node.type), ['sine', 'sine', 'sine', 'triangle']);
  assert.equal(context.sources[3].frequency.value, 110);
});
