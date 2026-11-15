import React from 'react';

// The fixed backdrop behind every view (docs/design-system.md §4): soft pastel light that the
// frosted glass refracts, a faint dot field, two orbit lines and film grain. Purely decorative.
const BLOBS = [
  { left: '-6%', top: '6%', width: '34%', height: '46%', background: '#9EBCE6' },
  { left: '14%', top: '46%', width: '20%', height: '26%', background: '#A4D6D2' },
  { right: '-4%', top: '4%', width: '30%', height: '34%', background: '#C3B8EC' },
  { right: '6%', top: '40%', width: '22%', height: '28%', background: '#F4CDB4', opacity: .6 },
  { left: '20%', bottom: '-10%', width: '60%', height: '30%', background: '#B7C6EE' },
  { right: '-8%', bottom: '-6%', width: '30%', height: '26%', background: '#A4D6D2', opacity: .6 },
];

export function Backdrop() {
  return <div className="backdrop" aria-hidden="true">
    {BLOBS.map((style, i) => <span key={i} className="backdrop-blob" style={style}/>)}
    <div className="backdrop-dots"/>
    <svg className="backdrop-orbits" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <ellipse cx="720" cy="430" rx="560" ry="190" transform="rotate(-14 720 430)" stroke="#FFFFFF" strokeOpacity=".7"/>
      <ellipse cx="720" cy="430" rx="760" ry="270" transform="rotate(-14 720 430)" stroke="#FFFFFF" strokeOpacity=".45"/>
      <ellipse cx="720" cy="450" rx="980" ry="360" transform="rotate(-14 720 450)" stroke="#6E87AF" strokeOpacity=".12"/>
      <circle cx="1262" cy="300" r="3" fill="#FFFFFF" fillOpacity=".9"/>
      <circle cx="198" cy="560" r="2.5" fill="#FFFFFF" fillOpacity=".8"/>
    </svg>
    <svg className="backdrop-grain">
      <filter id="backdrop-grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
      <rect width="100%" height="100%" filter="url(#backdrop-grain)"/>
    </svg>
  </div>;
}
