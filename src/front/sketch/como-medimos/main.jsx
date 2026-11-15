import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../theme/glass.css';
import { Brand } from '../vuelo/Icons.jsx';
import { Backdrop } from '../vuelo/Backdrop.jsx';
import { instruments } from './content.js';
import { missionDocument, missionReference } from './missionDocument.js';

import { applicationHref } from './navigation.js';
import './style.css';
import { useCardStack } from './useCardStack.js';

const cards = [missionReference, ...instruments];

function InstrumentImage({ item, first }) {
  const [failed, setFailed] = useState(false);
  return <div className="measure-image" data-instrument={item.id}>{failed
    ? <span className="measure-image-fallback" role="img" aria-label={item.alt}>{item.kind === 'document' ? 'Preview unavailable' : 'Photo unavailable'} · {item.model}</span>
    : <img src={item.image} alt={item.alt} width="1000" height="750" loading={first ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>}</div>;
}
function App() {
  const back = applicationHref(window.location.href);
  const [documentOpen, setDocumentOpen] = useState(() => window.location.hash === '#documento-nasa');
  const stack = useRef(null);
  useCardStack(stack);
  return <div className="measure-page">
    <Backdrop/>
    <a className="measure-skip" href="#contenido">Skip to content</a>
    <header className="measure-header glass-bar"><div>
      <a className="measure-brand" href={back} aria-label="Trama · back to the app"><Brand/></a>
      <a className="btn-link" href={back}>← Back to Trama</a>
    </div></header>
    <main id="contenido" className="measure-main" tabIndex={-1}>
      <header className="measure-intro"><h1>How we measure</h1><p>Our health check plan and measuring instruments.</p></header>
      <div className="measure-strips" ref={stack}>
        {cards.map((item, i) => <section className="measure-strip" style={{ '--card-index': i }} key={item.id} aria-labelledby={'instrument-' + item.id}>
          <div className="measure-card glass">
          <InstrumentImage item={item} first={i === 0}/>
          <div className="measure-copy"><h2 id={'instrument-' + item.id}>{item.title}</h2><p>{item.text}</p>
            {item.kind === 'document' && <a className="measure-document-link btn-link" href="#documento-nasa" onClick={() => setDocumentOpen(true)}>View the NASA document ↓</a>}
          </div>
          </div>
        </section>)}
      </div>
      <section id="documento-nasa" className="measure-document glass" tabIndex={-1} aria-label="NASA reference document">
        <details open={documentOpen} onToggle={event => setDocumentOpen(event.currentTarget.open)}>
          <summary>Read the NASA document</summary>
          <div className="measure-document-content">
            <div className="measure-document-toolbar"><a href={missionDocument.source} target="_blank" rel="noopener noreferrer">{missionDocument.revision} ↗</a>
              <a href={missionDocument.pdf + '#page=33'} target="_blank" rel="noopener noreferrer">Open PDF in a new tab ↗</a></div>
            <p>The sample schedule for a 180-day mission is on pages 33–37. If the document does not display here, you can open it in a new tab.</p>
            {documentOpen && <iframe src={missionDocument.pdf + '#page=33&view=FitH'} title="NASA medical standard: mission health check schedule"/>}
          </div>
        </details>
      </section>
      <footer className="measure-footer glass">
        <p>We do not have access to live readings from these instruments, so we generate simulated measurements using historical data and documented assumptions.</p>
        <p><a href="https://github.com/IgnacioAVerdinelli/NASASpaceApps" target="_blank" rel="noopener noreferrer">View the repository on GitHub ↗</a></p>
      </footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
