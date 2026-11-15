import React from 'react';

const paths = {
  expand: <><path d="M14 4h6v6m0-6-7 7m-3 9H4v-6m0 6 7-7"/></>,
  check: <><path d="m8 12 3 3 5-6"/><circle cx="12" cy="12" r="9"/></>,
  rotate: <><path d="M19 9c-2-3-9-4-13-1s-3 6 2 8c5 2 10 0 12-2m-1-9v4h-4"/></>,
  summary: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="2"/><rect x="14" y="11" width="7" height="10" rx="2"/></>,
  fuerza: <><path d="m8 16 8-8M6 19l-2-2m13-13 3 3M3 13l8 8m2-18 8 8M5 11l8 8m-2-14 8 8"/></>,
  aerobica: <path d="M12 3v8m0-2-3 3m3-3 3 3M9 7c-1-2-3 1-4 3-2 3-3 8-2 10 1 2 6-1 7-3V9m5-2c1-2 3 1 4 3 2 3 3 8 2 10-1 2-6-1-7-3V9"/>,
  vitales: <><rect x="5" y="6" width="14" height="12" rx="4"/><path d="m8 6 1-4h6l1 4m-8 12 1 4h6l1-4M8 12h2l1.2-2.4 1.7 4.6 1.2-2.2H16"/></>,
  ojos: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  venas: <><path d="M9 3c0 5-3 6-3 10a6 6 0 0 0 12 0c0-4-3-5-3-10"/><path d="M12 9v8m-2.5-2.5L12 17l2.5-2.5"/></>,
  plan: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 3h3"/></>,
  body: <><circle cx="12" cy="4" r="2"/><path d="m3 8 6 1h6l6-1m-12 2 .7 5L8 22m7-12-.7 5 1.7 7M12 15l-2 7m2-7 2 7"/></>,
  crew: <><circle cx="12" cy="8" r="3.6"/><path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21"/></>,
  down: <path d="m7 10 5 5 5-5"/>,
  orbit: <><circle cx="12" cy="12" r="6.6"/><ellipse cx="12" cy="12" rx="11" ry="3.3" transform="rotate(-34 12 12)"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
  pulse: <path d="M2 13h4l3-7 5 13 3-8 2 2h3"/>,
};

export function Icon({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Brand() {
  return <span className="trama-brand" translate="no">
    <svg aria-hidden="true" viewBox="0 0 38 38" width="34" height="34" fill="none">
      <rect width="38" height="38" rx="11" fill="#2F45C0"/>
      <g stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 24 8-14 5 9 4-7 7 12"/><path d="m13 26 7-12 6 11"/>
      </g>
    </svg>
    GraviTal
  </span>;
}
