export const instruments = ['Kick', 'Virveli', 'Taputus', 'Hi-hat', 'Basso'] as const;
export type Pattern = boolean[][];
export type RhythmClip = { pattern: Pattern; notes: BassNote[] };
export type SampleSlot = { name: string; buffer: AudioBuffer; enabled: boolean } | null;
export const bassNotes = ['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2'] as const;
export type BassNote = typeof bassNotes[number];

export function bassFrequency(note: BassNote): number {
  // MIDI note 36 is C2; equal temperament uses 12 semitones per octave.
  return 440 * 2 ** ((36 + bassNotes.indexOf(note) - 69) / 12);
}

// AudioContext's clock schedules sound; animation frames only draw the playhead.
export class StudioAudio {
  private output = this.context.createGain();
  private tracks = instruments.map(() => this.context.createGain());
  private noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
  private sources = new Set<AudioScheduledSourceNode>();
  private timer?: number;
  private frame?: number;
  private generation = 0;
  private samples: SampleSlot[] = [];

  setSamples(samples: SampleSlot[]) { this.samples = samples; }

  async decodeSample(data: ArrayBuffer): Promise<AudioBuffer> {
    const header = new Uint8Array(data, 0, Math.min(12, data.byteLength));
    const tag = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
    if (tag(0, 4) !== 'RIFF' || tag(8, 12) !== 'WAVE') throw new Error('Valitse WAV-tiedosto.');
    const buffer = await this.context.decodeAudioData(data);
    if (buffer.duration <= 0 || buffer.duration > 5 || buffer.numberOfChannels > 2) {
      throw new Error('Valitse enintään 5 sekunnin mono- tai stereo-rumpuisku.');
    }
    return buffer;
  }

  constructor(private context: AudioContext | OfflineAudioContext = new AudioContext()) {
    const compressor = this.context.createDynamicsCompressor();
    this.output.gain.value = 0.35;
    this.output.connect(compressor);
    this.tracks.forEach(track => track.connect(this.output));
    compressor.connect(this.context.destination);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }

  setVolumes(volumes: number[], smooth = true) {
    this.tracks.forEach((track, index) => {
      const value = volumes[index] ?? 1;
      const volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
      // Smooth the gain change so moving a slider doesn't create clicks.
      if (smooth) track.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
      else track.gain.value = volume;
    });
  }

  private voice(track: number, source: AudioScheduledSourceNode, signal: AudioNode, time: number, duration: number, volume: number, sampled = false) {
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + Math.min(0.003, duration / 4));
    if (sampled) envelope.gain.setValueAtTime(volume, time + Math.max(duration / 2, duration - 0.005));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    signal.connect(envelope).connect(this.tracks[track]);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      signal.disconnect();
      envelope.disconnect();
    };
    source.start(time);
    source.stop(time + duration + 0.01);
  }

  private tone(track: number, time: number, frequency: number, endFrequency: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration * 0.6);
    this.voice(track, oscillator, oscillator, time, duration, volume);
  }

  private hiss(track: number, time: number, duration: number, volume: number, frequency: number, type: BiquadFilterType) {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    source.connect(filter);
    this.voice(track, source, filter, time, duration, volume);
  }

  private hit(instrument: number, time: number, note: BassNote = 'C2') {
    const sample = this.samples[instrument];
    if (instrument < 4 && sample?.enabled) {
      const source = this.context.createBufferSource();
      source.buffer = sample.buffer;
      this.voice(instrument, source, source, time, sample.buffer.duration, 1, true);
      return;
    }
    switch (instrument) {
      case 0: this.tone(instrument, time, 150, 45, 0.38, 0.9); break;
      case 1:
        this.tone(instrument, time, 185, 90, 0.12, 0.3);
        this.hiss(instrument, time, 0.18, 0.65, 1400, 'highpass');
        break;
      case 2:
        for (let i = 0; i < 3; i++) this.hiss(instrument, time + i * 0.012, i === 2 ? 0.18 : 0.015, 0.4, 1600, 'bandpass');
        break;
      case 3: this.hiss(instrument, time, 0.065, 0.35, 7000, 'highpass'); break;
      case 4: {
        const frequency = bassFrequency(note);
        this.tone(instrument, time, frequency, frequency, 0.2, 0.6, 'triangle');
        break;
      }
    }
  }

  async preview(instrument: number, note: BassNote = 'C2') {
    const generation = this.generation;
    await this.context.resume();
    if (generation === this.generation) this.hit(instrument, this.context.currentTime + 0.01, note);
  }

  async start(read: () => { pattern: Pattern; bpm: number; notes?: BassNote[]; solos?: boolean[]; clips?: RhythmClip[]; sequence?: number[] }, onStep: (step: number, bar?: number, clip?: number) => void) {
    this.stop();
    const generation = this.generation;
    await this.context.resume();
    if (generation !== this.generation) return;
    let nextTime = this.context.currentTime + 0.04;
    let step = 0;
    let bar = 0;
    let clipIndex: number | undefined;
    const queue: { time: number; step: number; bar: number; clip?: number }[] = [];
    const schedule = () => {
      // Skip missed time after background throttling instead of playing a burst.
      if (nextTime < this.context.currentTime) nextTime = this.context.currentTime + 0.02;
      while (nextTime < this.context.currentTime + 0.1) {
        const state = read();
        if (step === 0) clipIndex = state.sequence?.[bar];
        const clip = clipIndex === undefined ? undefined : state.clips?.[clipIndex];
        const { bpm, solos } = state;
        const pattern = clip?.pattern ?? state.pattern;
        const notes = clip?.notes ?? state.notes;
        const hasSolo = solos?.some(Boolean) ?? false;
        pattern.forEach((track, index) => {
          if (track[step] && (!hasSolo || solos?.[index])) this.hit(index, nextTime, notes?.[step]);
        });
        queue.push({ time: nextTime, step, bar, clip: clipIndex });
        nextTime += 60 / bpm / 4;
        step = (step + 1) % 16;
        if (step === 0) bar = (bar + 1) % (state.sequence?.length ?? 1);
      }
    };
    const draw = () => {
      let current: typeof queue[number] | undefined;
      while (queue.length && queue[0].time <= this.context.currentTime) current = queue.shift()!;
      if (current !== undefined) onStep(current.step, current.bar, current.clip);
      this.frame = requestAnimationFrame(draw);
    };
    schedule();
    this.timer = window.setInterval(schedule, 25);
    this.frame = requestAnimationFrame(draw);
  }

  stop() {
    this.generation++;
    window.clearInterval(this.timer);
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    for (const source of this.sources) {
      source.stop();
      source.disconnect();
    }
    this.sources.clear();
  }

  dispose() {
    this.stop();
    if ('close' in this.context) void this.context.close();
  }

  async render(pattern: Pattern, notes: BassNote[], bpm: number, bars: number, clips?: RhythmClip[], sequence?: number[]): Promise<AudioBuffer> {
    if (!(this.context instanceof OfflineAudioContext)) throw new Error('Offline context required');
    const interval = 60 / bpm / 4;
    for (let step = 0; step < bars * 16; step++) {
      const clip = sequence && clips ? clips[sequence[Math.floor(step / 16) % sequence.length]] : undefined;
      (clip?.pattern ?? pattern).forEach((row, track) => {
        if (row[step % 16]) this.hit(track, step * interval, (clip?.notes ?? notes)[step % 16]);
      });
    }
    return this.context.startRendering();
  }
}

// Uncompressed stereo PCM: ordinary players can open the resulting WAV file.
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const bytes = buffer.length * channels * 2;
  const result = new ArrayBuffer(44 + bytes);
  const view = new DataView(result);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let sample = 0; sample < buffer.length; sample++) {
    for (let channel = 0; channel < channels; channel++) {
      const raw = data[channel][sample];
      const value = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0;
      view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true);
      offset += 2;
    }
  }
  return result;
}

export async function renderWav(sound: { pattern: Pattern; notes: BassNote[]; volumes: number[]; bpm: number; samples?: SampleSlot[]; clips?: RhythmClip[]; sequence?: number[] }): Promise<Blob> {
  const sampleRate = 44100;
  const bars = 4;
  // Half a second preserves the last kick/clap decay and compressor release.
  const tail = Math.max(0.5, ...(sound.samples ?? []).map(sample => sample?.enabled ? sample.buffer.duration + 0.1 : 0));
  const duration = bars * 4 * 60 / sound.bpm + tail;
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const synth = new StudioAudio(context);
  synth.setVolumes(sound.volumes, false);
  synth.setSamples(sound.samples ?? []);
  const buffer = await synth.render(sound.pattern, sound.notes, sound.bpm, bars, sound.clips, sound.sequence);
  return new Blob([encodeWav(buffer)], { type: 'audio/wav' });
}
