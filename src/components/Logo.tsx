import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  height?: number | string;
  className?: string;
}

export default function Logo({ height, className = '', ...props }: LogoProps) {
  const logoStyle: React.CSSProperties = { width: 'auto', ...((height !== undefined && height !== null) ? { height } : {}) };
  return (
    <svg
      viewBox="0 0 680 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={logoStyle}
      className={`select-none ${className}`}
      {...props}
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Inter:wght@400;700;900&display=swap');
          .logo-thai {
            font-family: 'Sarabun', 'Inter', sans-serif;
            font-weight: 500;
          }
          .logo-serif {
            font-family: 'Playfair Display', 'Georgia', serif;
          }
          .logo-sans {
            font-family: 'Inter', sans-serif;
            font-weight: 900;
          }
        `}
      </style>

      {/* Thai Top Text */}
      <text
        x="32"
        y="28"
        fill="#23b5b5"
        fontSize="21"
        letterSpacing="0.02em"
        className="logo-thai"
      >
        บริษัท บี ไอเดีย คอนสตรัคชั่น จำกัด
      </text>

      {/* Swoosh Arch Curve - masterfully widened for the 680 container */}
      <path
        d="M 12 60 C 200 14, 460 18, 660 108 C 460 38, 200 34, 12 60 Z"
        fill="#23b5b5"
      />

      {/* B . Idea Text Group */}
      <text
        x="20"
        y="290"
        fill="#23b5b5"
        fontSize="225"
        className="logo-serif"
        fontWeight="800"
      >
        B
      </text>

      {/* Dot */}
      <circle
        cx="198"
        cy="192"
        r="15"
        fill="#23b5b5"
      />

      <text
        x="230"
        y="290"
        fill="#23b5b5"
        fontSize="225"
        className="logo-serif"
        fontWeight="normal"
      >
        Idea
      </text>

      {/* CONSTRUCTION spaced bottom text */}
      <text
        x="26"
        y="352"
        fill="#23b5b5"
        fontSize="44"
        letterSpacing="0.38em"
        className="logo-sans"
      >
        CONSTRUCTION
      </text>
    </svg>
  );
}
