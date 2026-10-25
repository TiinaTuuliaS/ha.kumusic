import type { BassNote, Pattern, SampleSlot, RhythmClip } from './audio';

type StoredSample = { name: string; enabled: boolean; sampleRate: number; channels: string[] };

export type Sound = {
  id: string; name: string; updatedAt: string; pattern: Pattern;
  notes: BassNote[]; volumes: number[]; bpm: number;
  samples?: (StoredSample | null)[];
  clips?: [RhythmClip, RhythmClip];
  sequence?: number[];
};
const key = 'haku-sounds-v1';

function validClip(value: unknown): value is RhythmClip {
  if (!value || typeof value !== 'object') return false;
  const clip = value as RhythmClip;
  return Array.isArray(clip.pattern) && clip.pattern.length === 5 && clip.pattern.every(row => Array.isArray(row) && row.length === 16 && row.every(step => typeof step === 'boolean')) &&
    Array.isArray(clip.notes) && clip.notes.length === 16 && clip.notes.every(note => typeof note === 'string' && /^(C#?|D#?|E|F#?|G#?|A#?|B)2$/.test(note));
}

export function getSoundClips(sound: Pick<Sound, 'pattern' | 'notes' | 'clips'>): [RhythmClip, RhythmClip] {
  const clips = sound.clips ?? [
    { pattern: sound.pattern, notes: sound.notes },
    { pattern: Array.from({ length: 5 }, () => Array(16).fill(false)), notes: Array(16).fill('C2') },
  ];
  return clips.map(clip => ({ pattern: clip.pattern.map(row => [...row]), notes: [...clip.notes] })) as [RhythmClip, RhythmClip];
}

function encodeChannel(values: Float32Array): string {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

function decodeChannel(value: string): Float32Array<ArrayBuffer> {
  if (value.length > 5120000 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid sample data');
  const binary = atob(value);
  if (!binary.length || binary.length % 4 !== 0) throw new Error('Invalid sample length');
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const result = new Float32Array(bytes.length / 4);
  for (let i = 0; i < result.length; i++) {
    result[i] = view.getFloat32(i * 4, true);
    if (!Number.isFinite(result[i]) || Math.abs(result[i]) > 16) throw new Error('Invalid sample value');
  }
  return result;
}

export function storeSamples(samples: SampleSlot[]): (StoredSample | null)[] {
  return samples.map(sample => sample ? {
    name: sample.name, enabled: sample.enabled, sampleRate: sample.buffer.sampleRate,
    channels: Array.from({ length: sample.buffer.numberOfChannels }, (_, index) => encodeChannel(sample.buffer.getChannelData(index))),
  } : null);
}

export function restoreSamples(sound: Sound): SampleSlot[] {
  if (!sound.samples) return Array(4).fill(null);
  const context = new OfflineAudioContext(1, 1, 44100);
  return sound.samples.map(sample => {
    if (!sample) return null;
    const channels = sample.channels.map(decodeChannel);
    const buffer = context.createBuffer(channels.length, channels[0].length, sample.sampleRate);
    channels.forEach((channel, index) => buffer.copyToChannel(channel, index));
    return { name: sample.name, enabled: sample.enabled, buffer };
  });
}

function validSamples(samples: unknown): boolean {
  if (samples === undefined) return true; // Existing projects remain compatible.
  if (!Array.isArray(samples) || samples.length !== 4) return false;
  try {
    return samples.every(sample => {
      if (sample === null) return true;
      if (!sample || typeof sample.name !== 'string' || typeof sample.enabled !== 'boolean' ||
          !Number.isInteger(sample.sampleRate) || sample.sampleRate < 8000 || sample.sampleRate > 192000 ||
          !Array.isArray(sample.channels) || sample.channels.length < 1 || sample.channels.length > 2 ||
          !sample.channels.every((channel: unknown) => typeof channel === 'string')) return false;
      const channels = sample.channels.map(decodeChannel);
      return channels[0].length <= sample.sampleRate * 5 && channels.every((channel: Float32Array) => channel.length === channels[0].length);
    });
  } catch { return false; }
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('haku-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database blocked'));
  });
}

async function readLibrary(): Promise<unknown> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('library', 'readonly');
      const request = tx.objectStore('library').get('sounds');
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function writeLibrary(sounds: Sound[]): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('library', 'readwrite');
      tx.objectStore('library').put(sounds, 'sounds');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

function isSound(value: unknown): value is Sound {
  if (!value || typeof value !== 'object') return false;
  const sound = value as Record<string, unknown>;
  return (sound.sequence === undefined || (Array.isArray(sound.sequence) && sound.sequence.length === 4 && sound.sequence.every(value => value === 0 || value === 1))) && (sound.clips === undefined || (Array.isArray(sound.clips) && sound.clips.length === 2 && sound.clips.every(validClip))) && validSamples(sound.samples) && typeof sound.id === 'string' && typeof sound.name === 'string' && sound.name.trim().length > 0 &&
    typeof sound.updatedAt === 'string' && Number.isFinite(Date.parse(sound.updatedAt)) &&
    typeof sound.bpm === 'number' && Number.isInteger(sound.bpm) && sound.bpm >= 40 && sound.bpm <= 240 &&
    Array.isArray(sound.pattern) && sound.pattern.length === 5 && sound.pattern.every(row => Array.isArray(row) && row.length === 16 && row.every(step => typeof step === 'boolean')) &&
    Array.isArray(sound.notes) && sound.notes.length === 16 && sound.notes.every(note => typeof note === 'string' && /^(C#?|D#?|E|F#?|G#?|A#?|B)2$/.test(note)) &&
    Array.isArray(sound.volumes) && sound.volumes.length === 5 && sound.volumes.every(volume => typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 1);
}

export async function loadSounds(): Promise<Sound[]> {
  let data = await readLibrary();
  if (data === undefined) {
    const raw = localStorage.getItem(key);
    data = raw === null ? [] : JSON.parse(raw);
  }
  if (!Array.isArray(data) || !data.every(isSound)) throw new Error('Invalid sound library');
  return data;
}

export async function saveSound(sound: Sound): Promise<Sound[]> {
  if (!isSound(sound)) throw new Error('Invalid sound');
  const sounds = await loadSounds();
  const next = [sound, ...sounds.filter(item => item.id !== sound.id)];
  await writeLibrary(next);
  return next;
}

export function exportSound(sound: Sound): string {
  if (!isSound(sound)) throw new Error('Invalid sound');
  return JSON.stringify({ format: 'ha.ku-sound', version: 4, sound }, null, 2);
}

export async function importSound(text: string): Promise<Sound[]> {
  const data = JSON.parse(text);
  if (!data || data.format !== 'ha.ku-sound' || ![1, 2, 3, 4].includes(data.version) || !isSound(data.sound)) {
    throw new Error('Tiedosto ei ole tuettu ha.ku-soundi.');
  }
  // A fresh identity ensures importing a backup never overwrites existing work.
  const sound: Sound = {
    id: crypto.randomUUID(), name: data.sound.name, updatedAt: new Date().toISOString(),
    pattern: data.sound.pattern, notes: data.sound.notes, volumes: data.sound.volumes, bpm: data.sound.bpm,
    ...(data.sound.samples ? { samples: data.sound.samples } : {}),
    ...(data.sound.clips ? { clips: data.sound.clips } : {}),
    ...(data.sound.sequence ? { sequence: data.sound.sequence } : {}),
  };
  return saveSound(sound);
}
