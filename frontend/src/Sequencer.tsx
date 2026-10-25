import { useEffect, useRef, useState } from 'react';
import { bassNotes, instruments, StudioAudio, type BassNote, type Pattern, type SampleSlot, type RhythmClip } from './audio';

export default function Sequencer({ pattern, onChange, notes, onNotesChange, volumes, onVolumesChange, bpm, onBpmChange, samples, onSamplesChange, clips, selectedClip, sequence, onSequenceChange }: {
  pattern: Pattern;
  onChange: (pattern: Pattern) => void;
  notes: BassNote[];
  onNotesChange: (notes: BassNote[]) => void;
  volumes: number[];
  onVolumesChange: (volumes: number[]) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  samples: SampleSlot[];
  onSamplesChange: (samples: SampleSlot[]) => void;
  clips: RhythmClip[];
  selectedClip: number;
  sequence: number[];
  onSequenceChange: (sequence: number[]) => void;
}) {
  const [tempoText, setTempoText] = useState(String(bpm));
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [sequenceMode, setSequenceMode] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);
  const [soundingClip, setSoundingClip] = useState(selectedClip);
  const [error, setError] = useState('');
  const [loadingSample, setLoadingSample] = useState<number | null>(null);
  const importGeneration = useRef(0);
  const [solos, setSolos] = useState(() => instruments.map(() => false));
  const hasSolo = solos.some(Boolean);
  const engine = useRef<StudioAudio | null>(null);
  const live = useRef({ pattern, bpm, notes, solos, clips, sequence: undefined as number[] | undefined });
  useEffect(() => { live.current = { pattern, bpm, notes, solos, clips, sequence: sequenceMode ? sequence : undefined }; }, [pattern, bpm, notes, solos, clips, sequence, sequenceMode]);
  useEffect(() => { engine.current?.setVolumes(volumes); }, [volumes]);
  useEffect(() => { engine.current?.setSamples(samples); }, [samples]);

  useEffect(() => () => {
    importGeneration.current++;
    engine.current?.dispose();
    engine.current = null;
  }, []);

  function audio() {
    engine.current ??= new StudioAudio();
    engine.current.setVolumes(volumes);
    engine.current.setSamples(samples);
    return engine.current;
  }

  function stop() {
    engine.current?.stop();
    setPlaying(false);
    setCurrentStep(-1);
    setCurrentBar(-1);
    setSequenceMode(false);
    setSolos(instruments.map(() => false));
  }

  async function play() {
    setError('');
    setPlaying(true);
    try { await audio().start(() => live.current, (step, bar, clip) => {
      setCurrentStep(step);
      setCurrentBar(bar ?? 0);
      setSoundingClip(clip ?? selectedClip);
    }); }
    catch { stop(); setError('Äänen käynnistys ei onnistunut. Kokeile uudelleen selaimessa, joka tukee Web Audiota.'); }
  }

  function playAll() {
    const next = instruments.map(() => false);
    setSolos(next);
    setSequenceMode(false);
    live.current = { pattern, bpm, notes, solos: next, clips, sequence: undefined };
    if (!playing || sequenceMode) void play();
  }

  function playSequence() {
    if (playing && sequenceMode) { stop(); return; }
    const next = instruments.map(() => false);
    setSolos(next);
    setSequenceMode(true);
    live.current = { pattern, bpm, notes, solos: next, clips, sequence };
    void play();
  }

  function toggleTrack(track: number) {
    // With no solo mask, the global transport is playing every track.
    const singlePlaying = playing && !sequenceMode;
    const next = singlePlaying
      ? (hasSolo ? solos : instruments.map(() => true)).map((active, index) => index === track ? !active : active)
      : instruments.map((_, index) => index === track);
    if (!next.some(Boolean)) { stop(); return; }
    setSolos(next);
    setSequenceMode(false);
    // Supply the new mask before the first audio scheduling pass.
    live.current = { ...live.current, pattern, bpm, notes, solos: next, sequence: undefined };
    if (!singlePlaying) void play();
  }

  async function preview(index: number, note?: BassNote) {
    setError('');
    try { await audio().preview(index, note); }
    catch { setError('Äänen esikuuntelu ei onnistunut. Kokeile uudelleen.'); }
  }

  async function importSample(track: number, file: File) {
    const generation = ++importGeneration.current;
    setLoadingSample(track);
    setError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('WAV-tiedoston enimmäiskoko on 10 Mt.');
      const synth = audio();
      const buffer = await synth.decodeSample(await file.arrayBuffer());
      if (generation !== importGeneration.current) return;
      const next = samples.map((sample, index) => index === track ? { name: file.name, buffer, enabled: true } : sample);
      onSamplesChange(next);
      synth.setSamples(next);
      await synth.preview(track);
    } catch (error) {
      if (generation === importGeneration.current) setError(error instanceof Error ? `Sampletuonti: ${error.message}` : 'Samplen tuonti ei onnistunut.');
    } finally { if (generation === importGeneration.current) setLoadingSample(null); }
  }

  return (
    <section className="sequencer" aria-labelledby="sequencer-title">
      <div className="sequencer-heading"><h2 id="sequencer-title">Biittiruudukko</h2><span>SYNTEESI + OMAT SAMPLET / 5 RAITAA</span></div>
      <div className="sequencer-body">
        <div className="transport" role="group" aria-label="Toiston säätimet">
          <button type="button" className="theme-toggle transport-play" onClick={playing && !sequenceMode && !hasSolo ? stop : playAll}>
            {playing && !sequenceMode && !hasSolo ? '■ Pysäytä' : '▶ Toista kaikki'}
          </button>
          <button className="theme-toggle" type="button" onClick={playSequence}>{playing && sequenceMode ? '■ Pysäytä järjestys' : '▶ Toista järjestys'}</button>
          <label>Tempo <input type="number" min={40} max={240} step={1} value={tempoText} onChange={event => {
            setTempoText(event.target.value);
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 40 && value <= 240) onBpmChange(Math.round(value));
          }} onBlur={() => setTempoText(String(bpm))} /> BPM</label>
          <span>{playing && sequenceMode ? `Tahti ${currentBar + 1 || 1}/4 · soi ${soundingClip === 0 ? 'A' : 'B'} · muokkaat ${selectedClip === 0 ? 'A' : 'B'}` : '4/4 · 16 askelta · 1 tahti'}</span>
          <div className="sequence-order" role="group" aria-label="Neljän tahdin soittojärjestys">
            <span>Soittojärjestys:</span>
            {sequence.map((clip, bar) => <label key={bar} className={playing && sequenceMode && currentBar === bar ? 'bar-current' : ''}>
              <span>Tahti {bar + 1}</span><select aria-label={`Tahdin ${bar + 1} kuvio`} value={clip} onChange={event => onSequenceChange(sequence.map((value, index) => index === bar ? Number(event.target.value) : value))}><option value={0}>A</option><option value={1}>B</option></select>
            </label>)}
            <span>↻ alusta</span>
          </div>
        </div>
        <details className="sample-panel">
          <summary>Äänilähteet · omat WAV-samplet</summary>
          <p className="sequencer-help">Tuo lyhyt rumpuisku (WAV, enintään 5 s / 10 Mt). Tallenna soundi, niin omat samplet ja äänilähdevalinnat säilyvät mukana kirjastossa. JSON-vienti sisältää myös samplet. WAV-vienti käyttää valittuja äänilähteitä.</p>
          <div className="sample-sources">{instruments.slice(0, 4).map((name, track) => <div className="sample-source" key={name}>
            <label>{name}<select aria-label={`${name}: äänilähde`} value={samples[track]?.enabled ? 'sample' : 'synth'} onChange={event => onSamplesChange(samples.map((sample, index) => index === track && sample ? { ...sample, enabled: event.target.value === 'sample' } : sample))}>
              <option value="synth">Synteesi</option><option value="sample" disabled={!samples[track]}>Oma sample</option>
            </select></label>
            <label className="sample-file">{loadingSample === track ? 'Tuodaan…' : 'Tuo WAV'}<input type="file" accept=".wav,audio/wav,audio/x-wav" disabled={loadingSample !== null} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importSample(track, file);
            }} /></label>
            <span>{samples[track]?.name ?? 'Ei tuotua samplea'}</span>
            <button className="theme-toggle" type="button" onClick={() => preview(track)}>Kuuntele</button>
          </div>)}</div>
        </details>
        <details className="sequencer-instructions">
        <summary>Ohjeet</summary>
        <p className="sequencer-help">Valitse askeleet ja paina Toista. Raidan nimestä voit kuunnella äänen. Valitse basson sävel ruudun alta (C2–B2): valinta esikuuntelee sävelen, mutta vain päälle kytketyt askeleet soivat toistossa.</p>
        <p className="sequencer-help">Raidan ▶ käynnistää sen rytmin heti. Lisää muita raitoja niiden ▶-painikkeista ja tauota raidan kuuntelu ⏸-painikkeella. Viimeisen raidan tauotus pysäyttää toiston; uusi käynnistys alkaa tahdin alusta.</p>
        </details>
        <p className="sequencer-help step-hint" id="step-help">Muokkaat kuviota {selectedClip === 0 ? 'A' : 'B'}. Toista järjestys soittaa neljä tahtia peräkkäin ja aloittaa alusta. Raidan ▶ ja Toista kaikki kuuntelevat valittua kuviota.</p>
        <div className="steps-scroll" role="group" aria-label="Viiden raidan biittiruudukko" aria-describedby="step-help">
          <div className="track-grid">
            {instruments.map((name, track) => (
              <div className={`track-row${hasSolo && !solos[track] ? ' track-silenced' : ''}`} key={name}>
                <div className="track-controls">
                <button className="track-name theme-toggle" type="button" aria-label={`Kuuntele: ${name}`} onClick={() => preview(track)}>{name} <span aria-hidden="true">♪</span></button>
                <button className="solo-toggle theme-toggle" type="button"
                  aria-label={`${playing && !sequenceMode && (!hasSolo || solos[track]) ? 'Tauota' : 'Toista'} raita: ${name}`}
                  aria-pressed={playing && !sequenceMode && (!hasSolo || solos[track])}
                  onClick={() => toggleTrack(track)}><span aria-hidden="true">{playing && !sequenceMode && (!hasSolo || solos[track]) ? '⏸' : '▶'}</span></button>
                <label className="track-volume">
                  <span>Vol. <output>{Math.round(volumes[track] * 100)} %</output></span>
                  <input type="range" min="0" max="100" step="1" value={Math.round(volumes[track] * 100)}
                    aria-label={`${name}: äänenvoimakkuus`} aria-valuetext={`${Math.round(volumes[track] * 100)} prosenttia`}
                    onChange={event => onVolumesChange(volumes.map((volume, index) => index === track ? Number(event.target.value) / 100 : volume))} />
                </label>
                </div>
                <div className="steps" role="group" aria-label={name}>
                  {pattern[track].map((active, step) => <div className="step-cell" key={step}><button type="button"
                    className={`step${step === currentStep && soundingClip === selectedClip ? ' step-current' : ''}`}
                    aria-label={`${name}, askel ${step + 1}${track === 4 ? `, ${notes[step]}` : ''}`} aria-pressed={active}
                    onClick={() => onChange(pattern.map((row, index) => index === track ? row.map((value, i) => i === step ? !value : value) : row))}>
                    <span className="step-number">{String(step + 1).padStart(2, '0')}</span>
                    {track === 4 && <span className="step-note" aria-hidden="true">{notes[step]}</span>}
                    <span className="step-light" aria-hidden="true" />
                  </button>
                  {track === 4 && <select className="note-select" aria-label={`Basson sävel, askel ${step + 1}`} value={notes[step]} onChange={event => {
                    const note = event.target.value as BassNote;
                    onNotesChange(notes.map((value, index) => index === step ? note : value));
                    void preview(4, note);
                  }}>{bassNotes.map(note => <option key={note} value={note}>{note}</option>)}</select>}
                  </div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sequencer-status"><span>{playing ? 'Toisto käynnissä' : 'Pysäytetty'} · {bpm} BPM · {hasSolo ? `Raidat: ${instruments.filter((_, index) => solos[index]).join(', ')}` : 'Kaikki raidat'}</span><span>Muista tallentaa työsi ennen sivun sulkemista.</span></div>
        <p role="status">{error}</p>
      </div>
    </section>
  );
}
