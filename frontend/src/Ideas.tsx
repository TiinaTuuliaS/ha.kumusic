import { useState } from 'react';

type Idea = { id: string; title: string; notes: string; mood: string };

function readIdeas(): Idea[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('haku-ideas') ?? '[]');
    return Array.isArray(data) ? data.filter((item): item is Idea =>
      item !== null && typeof item === 'object' &&
      ['id', 'title', 'notes', 'mood'].every(key => typeof item[key] === 'string'),
    ) : [];
  } catch { return []; }
}

export default function Ideas({ library, ideaId }: { library: boolean; ideaId?: string }) {
  const [ideas, setIdeas] = useState(readIdeas);
  const existing = ideas.find(idea => idea.id === ideaId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [mood, setMood] = useState(existing?.mood ?? '');
  const [message, setMessage] = useState('');

  if (library) return (
    <section className="ideas-library" aria-label="Tallennetut ideat">
      <a className="open-studio" href="#/idea">+ Uusi idea</a>
      <p className="sequencer-help">Ideat tallennetaan tämän selaimen muistiin.</p>
      {ideas.length === 0 ? <div className="empty-library"><h2>Tilaa ensimmäiselle ideallesi.</h2><p>Kirjoita tunnelma, lyriikan alku tai ajatus seuraavasta biisistä.</p></div> : (
        <ul className="idea-list">{ideas.map(idea => <li key={idea.id}>
          <a href={`#/idea/${idea.id}`}><h2>{idea.title}</h2><p>{idea.mood || 'Avaa muistiinpano'}</p></a>
        </li>)}</ul>
      )}
    </section>
  );

  if (ideaId && !existing) return <p>Ideaa ei löytynyt. <a className="back-link" href="#/ideas">Avaa omat ideat</a></p>;

  return (
    <form className="idea-editor" onSubmit={event => {
      event.preventDefault();
      const idea = { id: existing?.id ?? crypto.randomUUID(), title: title.trim(), notes, mood };
      if (!idea.title) { setMessage('Anna idealle nimi.'); return; }
      const next = existing ? ideas.map(item => item.id === existing.id ? idea : item) : [...ideas, idea];
      try {
        localStorage.setItem('haku-ideas', JSON.stringify(next));
        setIdeas(next);
        window.location.hash = '/ideas';
      } catch { setMessage('Tallennus ei onnistunut. Säilytä teksti kopioimalla se ennen sivulta poistumista.'); }
    }}>
      <div className="sequencer-heading"><h2>{existing ? 'Muokkaa ideaa' : 'Tyhjä sivu, uusi suunta'}</h2><span>MUISTIINPANO / 01</span></div>
      <div className="idea-fields">
        <label>Idean nimi<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Anna ideallesi nimi" /></label>
        <div className="moodboard">
          <label>Tunnelma & inspiraatio<textarea value={mood} onChange={event => setMood(event.target.value)} placeholder="Esim. yöbussi, sateinen kaupunki, pehmeä basso, 90-luvun trip hop…" /></label>
          <label>Muistiinpanot<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Rytmit, melodiat, lyriikat ja kaikki keskeneräiset ajatukset." /></label>
        </div>
        <p className="sequencer-help">Tallenna ennen poistumista. Muistiinpano säilyy tässä selaimessa; selaintietojen tyhjennys poistaa sen.</p>
        <div className="idea-actions"><button className="open-studio" type="submit">Tallenna idea</button><a className="back-link" href="#/ideas">Omat ideat →</a></div>
        <p role="status">{message}</p>
      </div>
    </form>
  );
}
