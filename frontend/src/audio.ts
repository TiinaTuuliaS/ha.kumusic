export const instruments = ['Kick', 'Virveli', 'Taputus', 'Hi-hat', 'Basso'] as const;
export type Pattern = boolean[][];

// AudioContext's clock schedules sound; animation frames only draw the playhead.
export class StudioAudio {
  private context = new AudioContext();
  private output = this.context.createGain();
  private noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
  private sources = new Set<AudioScheduledSourceNode>();
  private timer?: number;
  private frame?: number;
  private generation = 0;

  constructor() {
    const compressor = this.context.createDynamicsCompressor();
    this.output.gain.value = 0.35;
    this.output.connect(compressor);
    compressor.connect(this.context.destination);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }

  private voice(source: AudioScheduledSourceNode, signal: AudioNode, time: number, duration: number, volume: number) {
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    signal.connect(envelope).connect(this.output);
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

  private tone(time: number, frequency: number, endFrequency: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration * 0.6);
    this.voice(oscillator, oscillator, time, duration, volume);
  }

  private hiss(time: number, duration: number, volume: number, frequency: number, type: BiquadFilterType) {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    source.connect(filter);
    this.voice(source, filter, time, duration, volume);
  }

  private hit(instrument: number, time: number) {
    switch (instrument) {
      case 0: this.tone(time, 150, 45, 0.38, 0.9); break;
      case 1:
        this.tone(time, 185, 90, 0.12, 0.3);
        this.hiss(time, 0.18, 0.65, 1400, 'highpass');
        break;
      case 2:
        for (let i = 0; i < 3; i++) this.hiss(time + i * 0.012, i === 2 ? 0.18 : 0.015, 0.4, 1600, 'bandpass');
        break;
      case 3: this.hiss(time, 0.065, 0.35, 7000, 'highpass'); break;
      // C2: a single bass note for rhythm experiments before a melody editor.
      case 4: this.tone(time, 65.406, 65.406, 0.2, 0.6, 'triangle'); break;
    }
  }

  async preview(instrument: number) {
    const generation = this.generation;
    await this.context.resume();
    if (generation === this.generation) this.hit(instrument, this.context.currentTime + 0.01);
  }

  async start(read: () => { pattern: Pattern; bpm: number }, onStep: (step: number) => void) {
    this.stop();
    const generation = this.generation;
    await this.context.resume();
    if (generation !== this.generation) return;
    let nextTime = this.context.currentTime + 0.04;
    let step = 0;
    const queue: { time: number; step: number }[] = [];
    const schedule = () => {
      // Skip missed time after background throttling instead of playing a burst.
      if (nextTime < this.context.currentTime) nextTime = this.context.currentTime + 0.02;
      while (nextTime < this.context.currentTime + 0.1) {
        const { pattern, bpm } = read();
        pattern.forEach((track, index) => { if (track[step]) this.hit(index, nextTime); });
        queue.push({ time: nextTime, step });
        nextTime += 60 / bpm / 4;
        step = (step + 1) % 16;
      }
    };
    const draw = () => {
      let current: number | undefined;
      while (queue.length && queue[0].time <= this.context.currentTime) current = queue.shift()!.step;
      if (current !== undefined) onStep(current);
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
    void this.context.close();
  }
}
