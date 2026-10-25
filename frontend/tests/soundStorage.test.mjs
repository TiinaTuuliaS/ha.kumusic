import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
globalThis.crypto ??= { randomUUID };
const source = readFileSync(new URL('../src/soundStorage.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2022 } }).outputText;
const { loadSounds, saveSound, exportSound, importSound, storeSamples, restoreSamples, getSoundClips } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
let raw = null;
globalThis.localStorage = { getItem: () => raw };
beforeEach(() => { raw = null; globalThis.indexedDB = new IDBFactory(); });
const sound = () => ({ id: 'one', name: 'Ensimmäinen', updatedAt: '2026-10-25T12:00:00Z', bpm: 135,
  pattern: Array.from({ length: 5 }, () => Array(16).fill(true)), notes: Array(16).fill('D#2'), volumes: [0, 0.2, 0.4, 0.6, 1] });

test('saves and reloads all composition settings and updates without duplicating', async () => {
  assert.deepEqual(await loadSounds(), []);
  await saveSound(sound());
  assert.deepEqual(await loadSounds(), [sound()]);
  await saveSound({ ...sound(), name: 'Muokattu', bpm: 90 });
  assert.equal((await loadSounds()).length, 1);
  assert.equal((await loadSounds())[0].bpm, 90);
  await saveSound({ ...sound(), id: 'two' });
  assert.equal((await loadSounds()).length, 2);
});

test('legacy localStorage projects remain available and migrate on save', async () => {
  raw = JSON.stringify([sound()]);
  assert.deepEqual(await loadSounds(), [sound()]);
  await saveSound({ ...sound(), id: 'two' });
  raw = null;
  assert.equal((await loadSounds()).length, 2);
});

test('corrupt legacy data cannot be silently overwritten', async () => {
  raw = '{';
  await assert.rejects(() => loadSounds());
  await assert.rejects(() => saveSound(sound()));
  assert.equal(raw, '{');
});

test('database failure is reported instead of successful save', async () => {
  const factory = indexedDB;
  globalThis.indexedDB = { open() { throw new Error('blocked'); } };
  await assert.rejects(() => saveSound(sound()), /blocked/);
  globalThis.indexedDB = factory;
  assert.deepEqual(await loadSounds(), []);
});

test('JSON round trip preserves musical data without overwriting the original', async () => {
  await saveSound(sound());
  const file = exportSound(sound());
  const sounds = await importSound(file);
  assert.equal(sounds.length, 2);
  assert.notEqual(sounds[0].id, sound().id);
  for (const key of ['name', 'pattern', 'notes', 'bpm', 'volumes']) assert.deepEqual(sounds[0][key], sound()[key]);
  assert.deepEqual(sounds[1], sound());
  assert.equal((await importSound(file)).length, 3);
  const legacy = await importSound(JSON.stringify({ format: 'ha.ku-sound', version: 1, sound: sound() }));
  assert.equal(legacy.length, 4);
});

test('invalid versions and sample data leave existing projects untouched', async () => {
  await saveSound(sound());
  for (const data of ['{', 'null', '{}', JSON.stringify({ format: 'ha.ku-sound', version: 5, sound: sound() }),
    JSON.stringify({ format: 'ha.ku-sound', version: 2, sound: { ...sound(), samples: [{ name: 'bad', enabled: true, sampleRate: 44100, channels: ['bad!'] }, null, null, null] } })]) {
    await assert.rejects(() => importSound(data));
    assert.deepEqual(await loadSounds(), [sound()]);
  }
});

test('stereo samples and disabled source choices survive database and JSON round trips exactly', async () => {
  const channels = [new Float32Array([0, 0.25, -0.5, 1]), new Float32Array([1, -1, 0.1, 0])];
  const buffer = { sampleRate: 48000, numberOfChannels: 2, getChannelData: index => channels[index] };
  const samples = storeSamples([{ name: 'kick.wav', enabled: true, buffer }, { name: 'snare.wav', enabled: false, buffer }, null, null]);
  await saveSound({ ...sound(), samples });
  const loaded = (await loadSounds())[0];
  const imported = (await importSound(exportSound(loaded)))[0];
  assert.deepEqual(imported.samples, samples);
  globalThis.OfflineAudioContext = class {
    createBuffer(count, length, sampleRate) {
      const data = Array.from({ length: count }, () => new Float32Array(length));
      return { sampleRate, numberOfChannels: count, getChannelData: index => data[index], copyToChannel: (values, index) => data[index].set(values) };
    }
  };
  const restored = restoreSamples(imported);
  assert.equal(restored[0].name, 'kick.wav');
  assert.equal(restored[1].enabled, false);
  assert.deepEqual(restored[0].buffer.getChannelData(0), channels[0]);
  assert.deepEqual(restored[0].buffer.getChannelData(1), channels[1]);
  assert.deepEqual(restoreSamples(sound()), [null, null, null, null]);
});

test('legacy patterns become A with an independent empty B', () => {
  const original = sound();
  const clips = getSoundClips(original);
  assert.deepEqual(clips[0].pattern, original.pattern);
  assert.equal(clips[1].pattern.flat().some(Boolean), false);
  clips[0].pattern[0][0] = false;
  clips[1].notes[0] = 'A2';
  assert.equal(original.pattern[0][0], true);
  assert.equal(clips[0].notes[0], 'D#2');
});

test('both rhythm variations and notes survive save and JSON import', async () => {
  const clips = getSoundClips(sound());
  clips[1].pattern[3][7] = true;
  clips[1].notes[7] = 'G2';
  const project = { ...sound(), clips };
  await saveSound(project);
  assert.deepEqual((await loadSounds())[0].clips, clips);
  const imported = (await importSound(exportSound(project)))[0];
  assert.deepEqual(imported.clips, clips);
  const restored = getSoundClips(imported);
  restored[1].pattern[3][7] = false;
  assert.equal(imported.clips[1].pattern[3][7], true);
  await assert.rejects(() => saveSound({ ...project, clips: [clips[0], { ...clips[1], notes: ['invalid'] }] }));
});

test('four-bar sequence survives save and backup while invalid sequences are rejected', async () => {
  const project = { ...sound(), clips: getSoundClips(sound()), sequence: [0, 0, 0, 1] };
  await saveSound(project);
  assert.deepEqual((await loadSounds())[0].sequence, [0, 0, 0, 1]);
  assert.deepEqual((await importSound(exportSound(project)))[0].sequence, [0, 0, 0, 1]);
  for (const sequence of [[0, 2, 0, 1], [0], 'AAAB']) await assert.rejects(() => saveSound({ ...project, sequence }));
});
