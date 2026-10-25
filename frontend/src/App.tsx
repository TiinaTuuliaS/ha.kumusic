import { useEffect, useRef, useState } from 'react';
import Ideas from './Ideas';
import Sequencer from './Sequencer';
import { instruments, type Pattern } from './audio';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/');
  const isStudio = route === '/studio';
  const isSounds = route === '/sounds';
  const isIdeas = route === '/ideas';
  const isIdea = route === '/idea' || route.startsWith('/idea/');
  const isHome = !isStudio && !isSounds && !isIdeas && !isIdea;
  const title = isStudio ? 'Sävellys' : isSounds ? 'Omat soundit' : isIdeas ? 'Omat ideat' : route.startsWith('/idea/') ? 'Muokkaa ideaa' : 'Uusi idea';
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

  const [pattern, setPattern] = useState<Pattern>(() => instruments.map(() => Array(16).fill(false)));

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
      <section className="welcome" aria-labelledby="welcome-title">
        <a className="desktop-note note-beats" href="#/sounds"><div className="sound-tile" aria-hidden="true"><i /><i /><i /><i /><i /></div><span>omat soundit</span></a>
        <a className="desktop-note note-spark" href="#/idea"><div className="spark-tile" aria-hidden="true">✳</div><span>uusi idea</span></a>
        <a className="desktop-note note-folder" href="#/ideas"><div className="folder" aria-hidden="true"><span>VOL. 01</span></div><span>omat ideat</span></a>
        <a className="desktop-note note-studio" href="#/studio">
          <div className="studio-tile" aria-hidden="true">
            <span className="studio-tile-bar" />
            <span className="studio-tile-grid">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</span>
          </div>
          <span>Studio</span>
        </a>
        <div className="welcome-copy">
        <p className="eyebrow">sun tila, sun visio</p>
        <h1 id="welcome-title" ref={pageHeading} tabIndex={-1}>ha<span>.ku</span></h1>
        <p className="intro">
          Tuleva selainstudiosi technoon, trip hopiin, tranceen ja eurodanceen.
          Sinä sävellät. Studio antaa tilan ideoillesi.
        </p>
        <a className="open-studio" href="#/studio">Avaa studio <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      ) : (
      <div className="composition-page">
        <a className="back-link" href="#/">← Takaisin etusivulle</a>
        <div className="composition-intro">
          <p className="eyebrow">sun tila, sun visio</p>
          <h1 className="composition-title" ref={pageHeading} tabIndex={-1}>{title}</h1>
          <p className="intro">{isStudio ? 'Ensimmäinen rytmisi alkaa tästä. Valitse askeleet biittiruudukosta.' : isSounds ? 'Oma kirjastosi tuleville sävellyksille.' : isIdeas ? 'Keskeneräiset ajatukset, joista voi syntyä jotain omaa.' : 'Kerää tunnelmat, inspiraatio ja biisiaihiot yhteen.'}</p>
        </div>
      {isStudio && <Sequencer pattern={pattern} onChange={setPattern} />}
      {isSounds && <section className="empty-library"><h2>Ensimmäinen soundisi odottaa syntymistään.</h2><p>Tänne tulevat myöhemmin omat tallennetut sävellyksesi. Kappaleiden tallennus ei ole vielä käytössä.</p><a className="open-studio" href="#/studio">Avaa studio ↗</a></section>}
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
