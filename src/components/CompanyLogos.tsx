import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const IenLogo: React.FC<LogoProps> = ({ className = "w-10 h-10", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 300 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Triangle Outline */}
      <polygon
        points="110,10 215,200 15,200"
        fill="none"
        stroke="#1A2B4C"
        strokeWidth="2"
      />
      {/* Solid Blue Inner Triangle */}
      <polygon
        points="85,30 170,185 0,185"
        fill="#0052FF"
      />
      {/* Overlay IEN Serif Text */}
      <text
        x="60"
        y="175"
        fontFamily="Times New Roman, Georgia, serif"
        fontWeight="900"
        fontSize="110"
        fill="#0052FF"
        letterSpacing="2"
      >
        IEN
      </text>
      <text
        x="60"
        y="175"
        fontFamily="Times New Roman, Georgia, serif"
        fontWeight="900"
        fontSize="110"
        fill="#FFFFFF"
        letterSpacing="2"
        clipPath="url(#ienClip)"
      >
        IEN
      </text>
      <clipPath id="ienClip">
        <polygon points="85,30 170,185 0,185" />
      </clipPath>
      
      {/* Subtitle */}
      <text
        x="150"
        y="230"
        fontFamily="Arial, sans-serif"
        fontWeight="900"
        fontSize="18"
        fill="#0033A0"
        textAnchor="middle"
        letterSpacing="2"
      >
        BUSINESS CONSULTANCY
      </text>
    </svg>
  );
};

export const SebLogo: React.FC<LogoProps> = ({ className = "w-10 h-10", size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 1. TOP FACE - GRAY (E) */}
      <polygon
        points="100,20 178,65 100,110 22,65"
        fill="#808285"
      />
      {/* Upper White Gap for E */}
      <polygon
        points="53.2,65 115.6,29 131.2,38 68.8,74"
        fill="#FFFFFF"
      />
      {/* Lower White Gap for E */}
      <polygon
        points="84.4,83 146.8,47 162.4,56 100,92"
        fill="#FFFFFF"
      />
      {/* Middle Arm White Tip Notch for E */}
      <polygon
        points="115.6,47 131.2,38 146.8,47 131.2,56"
        fill="#FFFFFF"
      />

      {/* 2. LEFT FACE - ORANGE (S) */}
      <polygon
        points="22,65 100,110 100,200 22,155"
        fill="#F15A24"
      />
      {/* Top-Right White Gap for S */}
      <polygon
        points="100,128 41.1,94 41.1,112 100,146"
        fill="#FFFFFF"
      />
      {/* Bottom-Left White Gap for S */}
      <polygon
        points="80.9,153 22,119 22,137 80.9,171"
        fill="#FFFFFF"
      />

      {/* 3. RIGHT FACE - TEAL (B) */}
      <polygon
        points="100,110 178,65 178,155 100,200"
        fill="#0097A7"
      />
      {/* Upper White Rectangle Hole for B */}
      <polygon
        points="119.1,117 158.9,94 158.9,112 119.1,135"
        fill="#FFFFFF"
      />
      {/* Lower White Rectangle Hole for B */}
      <polygon
        points="119.1,153 158.9,130 158.9,148 119.1,171"
        fill="#FFFFFF"
      />
      {/* Middle Right Edge Notch for B */}
      <polygon
        points="162.4,110 178,101 178,119 162.4,128"
        fill="#FFFFFF"
      />
    </svg>
  );
};

export const SebFullLogo: React.FC<{ size?: number; className?: string }> = ({ size = 52, className = "" }) => {
  return (
    <div className={`flex flex-col items-center leading-tight ${className}`}>
      <SebLogo size={size} />
      <div className="flex flex-col items-center leading-none text-center mt-1.5">
        <span className="font-black tracking-wider text-[#0097A7] uppercase text-[11px] sm:text-xs font-sans">
          EQUIPMENT &
        </span>
        <span className="font-black tracking-wider text-[#0097A7] uppercase text-[11px] sm:text-xs font-sans mt-0.5">
          SUPPLY CORP.
        </span>
      </div>
    </div>
  );
};

