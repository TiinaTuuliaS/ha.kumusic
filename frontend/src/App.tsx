import { useEffect, useRef, useState } from 'react';
import Ideas from './Ideas';
import Sequencer from './Sequencer';
import { instruments, renderWav, type Pattern, type BassNote, type SampleSlot, type RhythmClip } from './audio';
import { exportSound, getSoundClips, importSound, loadSounds, restoreSamples, saveSound, storeSamples, type Sound } from './soundStorage';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  const isStudio = route === '/studio';
  const isSounds = route === '/sounds';
  const isIdeas = route === '/ideas';
  const isIdea = route === '/idea' || route.startsWith('/idea/');
  const isHome = !isStudio && !isSounds && !isIdeas && !isIdea;
  const title = isStudio ? 'Studio' : isSounds ? 'Omat soundit' : isIdeas ? 'Omat ideat' : route.startsWith('/idea/') ? 'Muokkaa ideaa' : 'Uusi idea';
  const pageHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    function onNavigate() {
      setRoute(window.location.hash.slice(1) || '/');
    }
    window.addEventListener('hashchange', onNavigate);
    return () => window.removeEventListener('hashchange', onNavigate);
  }, []);

  useEffect(() => {
    document.title = isHome ? 'ha.ku' : `${title} – ha.ku`;
    pageHeading.current?.focus();
    window.scrollTo(0, 0);
  }, [route, isHome, title]);

  const [clips, setClips] = useState<[RhythmClip, RhythmClip]>(() => getSoundClips({ pattern: instruments.map(() => Array(16).fill(false)), notes: Array(16).fill('C2') }));
  const [selectedClip, setSelectedClip] = useState<0 | 1>(0);
  const [sequence, setSequence] = useState<number[]>([0, 0, 0, 1]);
  const { pattern, notes } = clips[selectedClip];
  function setPattern(value: Pattern) {
    setClips(current => current.map((clip, index) => index === selectedClip ? { ...clip, pattern: value } : clip) as [RhythmClip, RhythmClip]);
  }
  function setNotes(value: BassNote[]) {
    setClips(current => current.map((clip, index) => index === selectedClip ? { ...clip, notes: value } : clip) as [RhythmClip, RhythmClip]);
  }
  const [volumes, setVolumes] = useState(() => instruments.map(() => 1));
  const [samples, setSamples] = useState<SampleSlot[]>(() => Array(4).fill(null));
  const [bpm, setBpm] = useState(120);
  const [soundId, setSoundId] = useState<string>();
  const [soundName, setSoundName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [exportingWav, setExportingWav] = useState(false);
  const [wavMessage, setWavMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [library, setLibrary] = useState({ sounds: [] as Sound[], error: '' });
  useEffect(() => {
    let cancelled = false;
    loadSounds().then(sounds => {
      if (!cancelled) setLibrary({ sounds, error: '' });
    }).catch(() => {
      if (!cancelled) setLibrary({ sounds: [], error: 'Kirjaston lukeminen ei onnistunut. Tallennettuja tietoja ei muutettu.' });
    }).finally(() => { if (!cancelled) setLibraryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function saveCurrentSound() {
    if (!soundName.trim()) { setSaveMessage('Anna soundille nimi ennen tallentamista.'); return; }
    setSaving(true);
    try {
      const id = soundId ?? crypto.randomUUID();
      const sounds = await saveSound({ id, name: soundName.trim(), pattern: clips[0].pattern, notes: clips[0].notes, clips, sequence, volumes, bpm, samples: storeSamples(samples), updatedAt: new Date().toISOString() });
      setLibrary({ sounds, error: '' });
      setSoundId(id);
      setSaveMessage('Soundi ja omat samplet tallennettu tässä selaimessa. JSON-vienti sisältää myös samplet.');
    } catch { setSaveMessage('Tallennus ei onnistunut. Selaimen tallennustila voi olla estetty tai täynnä. Työsi on edelleen auki Studiossa.'); }
    finally { setSaving(false); }
  }

  function downloadSound(sound: Sound) {
    try {
      const blob = new Blob([exportSound(sound)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sound.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'haku-sound'}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setTransferMessage(`Vienti käynnistetty: ${sound.name}. Tiedosto sisältää viimeksi tallennetun version.`);
    } catch { setTransferMessage('Vienti ei onnistunut. Kokeile uudelleen.'); }
  }

  async function downloadWav(sound?: Sound, libraryClip: 0 | 1 = 0, arrangement = false) {
    const notify = sound ? setTransferMessage : setWavMessage;
    setExportingWav(true);
    notify('Muodostetaan WAV-tiedostoa…');
    // Capture the current version, including changes not yet saved to the library.
    const clipName = arrangement ? 'jarjestys' : (sound ? libraryClip : selectedClip) === 0 ? 'A' : 'B';
    const name = `${sound?.name ?? (soundName.trim() || 'ha.ku-biitti')}-${clipName}`;
    try {
      const source = sound ? { ...sound, ...getSoundClips(sound)[libraryClip] } : { pattern, notes, volumes, bpm };
      const snapshot = { pattern: source.pattern.map(row => [...row]), notes: [...source.notes], volumes: [...source.volumes], bpm: source.bpm, samples: sound ? restoreSamples(sound) : samples.map(sample => sample ? { ...sample } : null),
        ...(arrangement ? { clips: sound ? getSoundClips(sound) : getSoundClips({ ...clips[0], clips }), sequence: [...(sound ? sound.sequence ?? [0, 0, 0, 0] : sequence)] } : {}),
      };
      const blob = await renderWav(snapshot);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80)}.wav`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`WAV-lataus käynnistetty: ${name}, 4 tahtia. ${sound ? 'Mukana on kirjastoon tallennettu versio.' : 'Mukana on Studion nykyinen versio.'}`);
    } catch { notify('WAV-vienti ei onnistunut. Kokeile uudelleen selaimessa, joka tukee Offline Web Audiota.'); }
    finally { setExportingWav(false); }
  }

  async function uploadSound(file: File) {
    setImporting(true);
    setTransferMessage('');
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('Tiedosto on liian suuri');
      const sounds = await importSound(await file.text());
      setLibrary({ sounds, error: '' });
      setTransferMessage('Soundi tuotu kirjastoon uutena tallennuksena. Avaa se Studiossa jatkaaksesi.');
    } catch { setTransferMessage('Tuonti ei onnistunut. Valitse ha.kusta viety JSON-tiedosto (enintään 64 Mt) ja varmista, että selaimen tallennustila on käytettävissä. Nykyisiä tallennuksia ei muutettu.'); }
    finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function openSound(sound: Sound) {
    if (clips.some(clip => clip.pattern.some(row => row.some(Boolean))) && !window.confirm('Avataanko tallennettu soundi? Studion nykyiset tallentamattomat muutokset korvataan.')) return;
    let restored: SampleSlot[];
    try { restored = restoreSamples(sound); }
    catch { setTransferMessage('Soundin samplejen avaaminen ei onnistunut. Studion nykyistä työtä ei muutettu.'); return; }
    setClips(getSoundClips(sound));
    setSelectedClip(0);
    setSequence(sound.sequence ? [...sound.sequence] : [0, 0, 0, 0]);
    setSamples(restored);
    setVolumes([...sound.volumes]);
    setBpm(sound.bpm);
    setSoundId(sound.id);
    setSoundName(sound.name);
    setSaveMessage('');
    window.location.hash = '/studio';
  }

  function newSound() {
    if (clips.some(clip => clip.pattern.some(row => row.some(Boolean))) && !window.confirm('Aloitetaanko uusi soundi? Studion nykyiset tallentamattomat muutokset korvataan.')) return;
    setClips(getSoundClips({ pattern: instruments.map(() => Array(16).fill(false)), notes: Array(16).fill('C2') }));
    setSelectedClip(0);
    setSequence([0, 0, 0, 1]);
    setSamples(Array(4).fill(null));
    setVolumes(instruments.map(() => 1));
    setBpm(120);
    setSoundId(undefined);
    setSoundName('');
    setSaveMessage('');
    window.location.hash = '/studio';
  }

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#242129' : '#eeeced',
    );
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try { localStorage.setItem('haku-theme', nextTheme); } catch {
      // Theme switching still works if browser storage is unavailable.
    }
  }

  return (
    <main className="studio">
      <header className="studio-header">
        <a className="wordmark home-link" href="#/" aria-label="ha.ku – etusivu">ha.ku</a>
        <div className="header-tags">
          <span className="studio-label">Selainstudio</span>
          <span className="version">VOL. 001</span>
          <button className="theme-toggle" type="button" onClick={toggleTheme}
            aria-label="Tumma teema" aria-pressed={theme === 'dark'}>
            <span aria-hidden="true">{theme === 'dark' ? '◐' : '○'}</span>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      {isHome ? (
      <section className="welcome-window" aria-labelledby="welcome-title">
        <div className="sequencer-heading"><span className="window-caption">ha.ku / työpöytä</span><span>OMA TILA / 01</span></div>
        <div className="welcome">
        <div className="welcome-copy">
          <p className="eyebrow">sun tila, sun visio</p>
          <h1 id="welcome-title" ref={pageHeading} tabIndex={-1}>ha<span>.ku</span></h1>
          <p className="intro">
            Tuleva selainstudiosi technoon, trip hopiin, tranceen ja eurodanceen.
            Sinä sävellät. Studio antaa tilan ideoillesi.
          </p>
        </div>
        <nav className="desktop-icons" aria-label="Studion sivut">
        <a className="desktop-note note-studio" href="#/studio">
          <div className="studio-tile" aria-hidden="true">
            <span className="studio-tile-bar" />
            <span className="studio-tile-grid">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</span>
          </div>
          <span>Studio</span>
        </a>
        <a className="desktop-note note-spark" href="#/idea"><div className="spark-tile" aria-hidden="true">✳</div><span>uusi idea</span></a>
        <a className="desktop-note note-beats" href="#/sounds"><div className="sound-tile" aria-hidden="true"><i /><i /><i /><i /><i /></div><span>omat soundit</span></a>
        <a className="desktop-note note-folder" href="#/ideas"><div className="folder" aria-hidden="true"><span>VOL. 01</span></div><span>omat ideat</span></a>
        </nav>
        </div>
      </section>

      ) : (
      <div className={`composition-page${isStudio ? ' studio-page' : ''}`}>
        <a className="back-link" href="#/">← Takaisin etusivulle</a>
        <div className="composition-intro">
          <h1 className="composition-title" ref={pageHeading} tabIndex={-1}>{title}</h1>
          <p className="intro">{isStudio ? 'Ensimmäinen rytmisi alkaa tästä. Valitse askeleet biittiruudukosta.' : isSounds ? 'Oma kirjastosi tuleville sävellyksille.' : isIdeas ? 'Keskeneräiset ajatukset, joista voi syntyä jotain omaa.' : 'Kerää tunnelmat, inspiraatio ja biisiaihiot yhteen.'}</p>
        </div>
      {isStudio && <>
        <form className="sound-save" onSubmit={event => { event.preventDefault(); saveCurrentSound(); }}>
          <label>Soundin nimi<input maxLength={120} required value={soundName} onChange={event => { setSoundName(event.target.value); setSaveMessage(''); }} placeholder="Anna rytmillesi nimi" /></label>
          <button className="theme-toggle" type="submit" disabled={saving || libraryLoading}>{saving ? 'Tallennetaan…' : soundId ? 'Tallenna muutokset' : 'Tallenna soundi'}</button>
          <button className="theme-toggle" type="button" disabled={exportingWav || !pattern.some((row, index) => volumes[index] > 0 && row.some(Boolean))}
            onClick={() => void downloadWav()}>{exportingWav ? 'Muodostetaan…' : `Lataa WAV · kuvio ${selectedClip === 0 ? 'A' : 'B'}`}</button>
          <button className="theme-toggle" type="button" disabled={exportingWav || !sequence.some(index => clips[index].pattern.some((row, track) => volumes[track] > 0 && row.some(Boolean)))} onClick={() => void downloadWav(undefined, 0, true)}>Lataa WAV · järjestys</button>
          <a className="back-link" href="#/sounds">Omat soundit →</a>
          <p role="status">{saveMessage}</p>
          <p role="status">{wavMessage}</p>
        </form>
        <div className="clip-controls" role="group" aria-label="Rytmikuviot">
          <span>Muokkaa ja kuuntele:</span>
          {([0, 1] as const).map(index => <button className="theme-toggle clip-button" type="button" key={index} aria-pressed={selectedClip === index} onClick={() => { setSelectedClip(index); setWavMessage(''); }}>Kuvio {index === 0 ? 'A' : 'B'}</button>)}
          <button className="theme-toggle" type="button" onClick={() => {
            const target = selectedClip === 0 ? 1 : 0;
            if (clips[target].pattern.some(row => row.some(Boolean)) && !window.confirm('Korvataanko toisen kuvion askeleet ja sävelet nykyisen kuvion kopiolla?')) return;
            setClips(current => current.map((clip, index) => index === target ? { pattern: pattern.map(row => [...row]), notes: [...notes] } : clip) as [RhythmClip, RhythmClip]);
            setSaveMessage('');
          }}>Kopioi {selectedClip === 0 ? 'A → B' : 'B → A'}</button>
          <p>Valitse tästä muokattava kuvio. Kuvion vaihto pysäyttää toiston. Tempo, äänet ja voimakkuudet ovat yhteiset.</p>
        </div>
        <Sequencer key={selectedClip} pattern={pattern} onChange={value => { setPattern(value); setSaveMessage(''); }} notes={notes} onNotesChange={value => { setNotes(value); setSaveMessage(''); }} volumes={volumes} onVolumesChange={value => { setVolumes(value); setSaveMessage(''); }} bpm={bpm} onBpmChange={value => { setBpm(value); setSaveMessage(''); }} samples={samples} onSamplesChange={setSamples} clips={clips} selectedClip={selectedClip} sequence={sequence} onSequenceChange={value => { setSequence(value); setSaveMessage(''); }} />
      </>}
      {isSounds && <section aria-label="Tallennetut soundit">
        <button className="theme-toggle" type="button" onClick={newSound}>+ Uusi soundi</button>
        <button className="theme-toggle import-button" type="button" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? 'Tuodaan…' : 'Tuo JSON-tiedosto'}</button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.target.files?.[0];
          if (file) void uploadSound(file);
        }} />
        <p role="status" className="transfer-status">{transferMessage}</p>
        <p className="sequencer-help library-notice">Tallennukset ovat vain tässä selaimessa. Selaintietojen tyhjennys poistaa ne.</p>
        {library.error && <p role="alert">{library.error}</p>}
        {libraryLoading && <p role="status">Ladataan kirjastoa…</p>}
        {!libraryLoading && !library.error && library.sounds.length === 0 && <div className="empty-library"><h2>Tilaa ensimmäiselle soundillesi.</h2><p>Tallenna rytmi Studiossa, niin voit jatkaa sitä myöhemmin täällä.</p></div>}
        <ul className="idea-list">{library.sounds.map(sound => <li key={sound.id}>
          <button className="sound-card" type="button" onClick={() => openSound(sound)}>
            <h2>{sound.name}</h2><p>{sound.bpm} BPM · {sound.clips ? 'Kuviot A ja B' : 'Kuvio A'}</p>
            <p>Muokattu {new Date(sound.updatedAt).toLocaleString('fi-FI')}</p><span>Avaa Studiossa →</span>
          </button>
          <button className="theme-toggle export-button" type="button" onClick={() => downloadSound(sound)}>Vie JSON-tiedosto</button>
          <button className="theme-toggle export-button" type="button"
            disabled={exportingWav || !getSoundClips(sound)[0].pattern.some((row, index) => sound.volumes[index] > 0 && row.some(Boolean))}
            onClick={() => void downloadWav(sound)}>{exportingWav ? 'Muodostetaan WAV…' : 'Lataa WAV · kuvio A'}</button>
          {sound.clips && <button className="theme-toggle export-button" type="button"
            disabled={exportingWav || !sound.clips[1].pattern.some((row, index) => sound.volumes[index] > 0 && row.some(Boolean))}
            onClick={() => void downloadWav(sound, 1)}>{exportingWav ? 'Muodostetaan WAV…' : 'Lataa WAV · kuvio B'}</button>}
          {sound.sequence && <button className="theme-toggle export-button" type="button" disabled={exportingWav || !sound.sequence.some(index => getSoundClips(sound)[index].pattern.some((row, track) => sound.volumes[track] > 0 && row.some(Boolean)))} onClick={() => void downloadWav(sound, 0, true)}>Lataa WAV · järjestys</button>}
        </li>)}</ul>
      </section>}
      {(isIdeas || isIdea) && <Ideas key={route} library={isIdeas} ideaId={route.startsWith('/idea/') ? route.slice(6) : undefined} />}

      </div>
      )}

      <footer className="studio-footer">
        <span>Sinun ideasi. Sinun taajuutesi.</span>
        <span className="genres">TECHNO / TRIP HOP / TRANCE / EURODANCE</span>
      </footer>
    </main>
  );
}
