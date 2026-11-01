import React from 'react';

interface CSELogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  withText?: boolean;
  subtitle?: string | boolean;
  badgeText?: string;
  animated?: boolean;
  className?: string;
}

export const CSELogo: React.FC<CSELogoProps> = ({
  size = 'md',
  withText = false,
  subtitle = 'Collaborative Session Engine',
  badgeText,
  animated = true,
  className = ''
}) => {
  // Resolve numeric dimensions
  const getDimension = () => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'xs':
        return 22;
      case 'sm':
        return 30;
      case 'md':
        return 40;
      case 'lg':
        return 52;
      case 'xl':
        return 68;
      default:
        return 40;
    }
  };

  const dim = getDimension();

  // Typography sizing based on logo dimension
  const getTextSizes = () => {
    if (dim <= 24) {
      return { title: 'text-xs', subtitle: 'text-[9px]', badge: 'text-[8px] px-1 py-0.2' };
    }
    if (dim <= 32) {
      return { title: 'text-sm font-bold', subtitle: 'text-[9.5px]', badge: 'text-[9px] px-1.5 py-0.2' };
    }
    if (dim <= 44) {
      return { title: 'text-lg font-black', subtitle: 'text-[10.5px]', badge: 'text-[10px] px-2 py-0.5' };
    }
    if (dim <= 56) {
      return { title: 'text-2xl font-black', subtitle: 'text-xs', badge: 'text-[11px] px-2.5 py-0.5' };
    }
    return { title: 'text-3xl font-black', subtitle: 'text-sm', badge: 'text-xs px-3 py-1' };
  };

  const textSizes = getTextSizes();

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Logo Mark Vector Container */}
      <div
        className={`relative flex items-center justify-center shrink-0 transition-all duration-300 ${
          animated ? 'group-hover:scale-105 group-hover:rotate-1' : ''
        }`}
        style={{ width: dim, height: dim }}
      >
        {/* Ambient Halo Behind Mark */}
        {animated && (
          <div
            className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/25 via-indigo-600/35 to-rose-500/25 blur-md -z-10 opacity-70 group-hover:opacity-100 group-hover:blur-lg transition-all duration-300"
          />
        )}

        <svg
          viewBox="0 0 100 100"
          width={dim}
          height={dim}
          className="w-full h-full drop-shadow-md"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Background Obsidian Glass */}
            <linearGradient id="cse-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B0F19" />
              <stop offset="50%" stopColor="#111827" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </linearGradient>

            {/* Glowing Perimeter Ring */}
            <linearGradient id="cse-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#818CF8" stopOpacity="0.9" />
              <stop offset="70%" stopColor="#C084FC" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#34D399" stopOpacity="0.8" />
            </linearGradient>

            {/* Left Glyph 'C' Gradient */}
            <linearGradient id="cse-c-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>

            {/* Center Dynamic Stream 'S' Gradient */}
            <linearGradient id="cse-s-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#F43F5E" />
            </linearGradient>

            {/* Right Glyph 'E' Gradient */}
            <linearGradient id="cse-e-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            {/* Internal Core Radial Glow */}
            <radialGradient id="cse-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#A855F7" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>

            {/* Bloom Glow Filter */}
            <filter id="cse-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#6366F1" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Squircle Chassis */}
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="24"
            fill="url(#cse-bg-grad)"
            stroke="url(#cse-border-grad)"
            strokeWidth="2"
          />

          {/* Core Ambient Light */}
          <circle cx="50" cy="50" r="38" fill="url(#cse-core-glow)" />

          {/* Micro Grid Circuit Geometry */}
          <g opacity="0.16" stroke="#FFFFFF" strokeWidth="0.8" strokeDasharray="2 3">
            <line x1="20" y1="50" x2="80" y2="50" />
            <line x1="50" y1="20" x2="50" y2="80" />
            <circle cx="50" cy="50" r="22" />
          </g>

          {/* Left Bracket 'C' (Collaboration / Code) */}
          <path
            d="M 38 27 L 23 46 C 21 48.5 21 51.5 23 54 L 38 73"
            stroke="url(#cse-c-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#cse-glow)"
          />

          {/* Right Bracket 'E' (Engine / Execution) */}
          <path
            d="M 62 27 L 77 46 C 79 48.5 79 51.5 77 54 L 62 73"
            stroke="url(#cse-e-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#cse-glow)"
          />

          {/* Right 'E' Center Prong */}
          <line
            x1="58"
            y1="50"
            x2="73"
            y2="50"
            stroke="url(#cse-e-grad)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* Center Dynamic Stream 'S' (Session / Synchronization) */}
          <path
            d="M 57 32 C 43 28 39 42 50 49 C 62 56 57 71 42 67"
            stroke="url(#cse-s-grad)"
            strokeWidth="5.5"
            strokeLinecap="round"
            filter="url(#cse-glow)"
          />

          {/* Synapse Connection Nodes */}
          <circle cx="57" cy="32" r="3" fill="#F43F5E" />
          <circle cx="57" cy="32" r="1.2" fill="#FFFFFF" />

          <circle cx="50" cy="49" r="2.8" fill="#A855F7" />
          <circle cx="50" cy="49" r="1.2" fill="#FFFFFF" />

          <circle cx="42" cy="67" r="3" fill="#818CF8" />
          <circle cx="42" cy="67" r="1.2" fill="#FFFFFF" />

          {/* Top-Left & Bottom-Right Nano Quantum Pings */}
          <circle cx="23" cy="23" r="1.8" fill="#38BDF8" opacity="0.85" />
          <circle cx="77" cy="77" r="1.8" fill="#34D399" opacity="0.85" />
        </svg>
      </div>

      {/* Optional Accompanying Typography */}
      {withText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className={`${textSizes.title} tracking-tight font-heading font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5`}
            >
              <span>CSE</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400">
                .
              </span>
            </span>

            {badgeText && (
              <span
                className={`font-mono uppercase font-bold rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 shadow-xs ${textSizes.badge}`}
              >
                {badgeText}
              </span>
            )}
          </div>

          {subtitle && typeof subtitle === 'string' && (
            <span
              className={`${textSizes.subtitle} text-slate-500 dark:text-slate-400 tracking-wide font-sans leading-tight hidden sm:block`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
export default CSELogo;
