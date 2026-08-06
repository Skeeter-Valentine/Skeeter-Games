import React from 'react';

export default function SkeeterLogo({ size = 42 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0px 0px 8px rgba(255, 42, 133, 0.6))' }}
    >
      <defs>
        {/* Glow Filter */}
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Cyan Glow Filter */}
        <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="cyanBlur" />
          <feMerge>
            <feMergeNode in="cyanBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer Glow Ring / Container Background */}
      <rect x="5" y="5" width="90" height="90" rx="18" fill="#1c1830" />

      {/* --- 'S' LETTER (Cyan Layer) --- */}
      <path
        d="M 52 22 
           C 32 20, 22 32, 32 44 
           L 48 50 
           C 60 56, 52 74, 34 70 
           L 24 68"
        stroke="#00f0ff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#cyan-glow)"
      />

      {/* --- 'G' LETTER (Hot Pink Layer - Interlocked & Cut) --- */}
      <path
        d="M 72 32 
           C 62 20, 48 24, 48 24
           M 46 70
           C 64 76, 76 62, 76 48
           L 58 48"
        stroke="#ff2a85"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#neon-glow)"
      />

      {/* Central Interlocking Pulse Cut (Lightning Accent) */}
      <polygon
        points="56,36 42,54 50,54 44,66 58,48 50,48"
        fill="#00f0ff"
        filter="url(#cyan-glow)"
      />
    </svg>
  );
}