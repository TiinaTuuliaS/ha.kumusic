import { useEffect, useRef, useState } from 'react';
import { instruments, StudioAudio, type Pattern } from './audio';

export default function Sequencer({ pattern, onChange }: { pattern: Pattern; onChange: (pattern: Pattern) => void }) {
  const [bpm, setBpm] = useState(120);
  const [tempoText, setTempoText] = useState('120');
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState('');
  const engine = useRef<StudioAudio | null>(null);
  const live = useRef({ pattern, bpm });
  useEffect(() => { live.current = { pattern, bpm }; }, [pattern, bpm]);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  function audio() {
    engine.current ??= new StudioAudio();
    return engine.current;
  }

  function stop() {
    engine.current?.stop();
    setPlaying(false);
    setCurrentStep(-1);
  }

  async function play() {
    setError('');
    setPlaying(true);
    try { await audio().start(() => live.current, setCurrentStep); }
    catch { stop(); setError('Äänen käynnistys ei onnistunut. Kokeile uudelleen selaimessa, joka tukee Web Audiota.'); }
  }

  async function preview(index: number) {
    setError('');
    try { await audio().preview(index); }
    catch { setError('Äänen esikuuntelu ei onnistunut. Kokeile uudelleen.'); }
  }

  return (
    <section className="sequencer" aria-labelledby="sequencer-title">
      <div className="sequencer-heading"><h2 id="sequencer-title">Biittiruudukko</h2><span>OMA SYNTEESI / 5 RAITAA</span></div>
      <div className="sequencer-body">
        <div className="transport">
          <button type="button" className="theme-toggle" onClick={playing ? stop : play}>{playing ? '■ Pysäytä' : '▶ Toista'}</button>
          <label>Tempo <input type="number" min={40} max={240} step={1} value={tempoText} onChange={event => {
            setTempoText(event.target.value);
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 40 && value <= 240) setBpm(Math.round(value));
          }} onBlur={() => setTempoText(String(bpm))} /> BPM</label>
          <span>4/4 · 16 askelta · 1 tahti</span>
        </div>
        <p className="sequencer-help" id="step-help">Valitse askeleet ja paina Toista. Raidan nimestä voit kuunnella äänen. Basso soittaa tässä vaiheessa yhtä säveltä (C2).</p>
        <div className="steps-scroll" role="group" aria-label="Viiden raidan biittiruudukko" aria-describedby="step-help">
          <div className="track-grid">
            {instruments.map((name, track) => (
              <div className="track-row" key={name}>
                <button className="track-name theme-toggle" type="button" aria-label={`Kuuntele: ${name}`} onClick={() => preview(track)}>{name} <span aria-hidden="true">♪</span></button>
                <div className="steps" role="group" aria-label={name}>
                  {pattern[track].map((active, step) => <button key={step} type="button"
                    className={`step${step === currentStep ? ' step-current' : ''}`}
                    aria-label={`${name}, askel ${step + 1}`} aria-pressed={active}
                    onClick={() => onChange(pattern.map((row, index) => index === track ? row.map((value, i) => i === step ? !value : value) : row))}>
                    <span className="step-number">{String(step + 1).padStart(2, '0')}</span><span className="step-light" aria-hidden="true" />
                  </button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sequencer-status"><span>{playing ? 'Toisto käynnissä' : 'Pysäytetty'} · {bpm} BPM</span><span>Äänet syntyvät selaimessa. Kuviot nollautuvat sivun latauksessa.</span></div>
        <p role="status">{error}</p>
      </div>
    </section>
  );
}
