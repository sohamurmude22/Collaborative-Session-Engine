import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'academic' | 'emerald' | 'frost' | 'aurora' | 'cyberpunk';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  tagline: string;
  badge: string;
  bgPage: string;
  bgCard: string;
  bgHeader: string;
  border: string;
  accent: string;
  accentText: string;
  accentBg: string;
  accentHover: string;
  monacoTheme: 'vs' | 'vs-dark';
  editorBg: string;
  glow: string;
  pillColor: string;
  isDark?: boolean;
}

export const THEME_CONFIGS: Record<AppTheme, ThemeConfig> = {
  aurora: {
    id: 'aurora',
    name: 'Aurora Cyberwave',
    tagline: 'Vibrant neon fuchsia, electric violet, and deep cosmic obsidian for boundless creativity',
    badge: '🌌 Aurora Cyber',
    bgPage: 'bg-[#0b0f19]',
    bgCard: 'bg-[#111827]/90 text-slate-100',
    bgHeader: 'bg-[#0f172a]/95 text-slate-100',
    border: 'border-violet-500/30',
    accent: 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500',
    accentText: 'text-fuchsia-400',
    accentBg: 'bg-violet-950/60',
    accentHover: 'hover:bg-violet-600',
    monacoTheme: 'vs-dark',
    editorBg: '#0f172a',
    glow: 'shadow-[0_0_25px_rgba(192,132,252,0.25)]',
    pillColor: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white',
    isDark: true
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Neon Synthwave',
    tagline: 'High-contrast cyan lasers, hot magenta accents & dark matrix vibes',
    badge: '⚡ Synthwave',
    bgPage: 'bg-[#080d1a]',
    bgCard: 'bg-[#0f172e]/90 text-slate-100',
    bgHeader: 'bg-[#0b1224]/95 text-slate-100',
    border: 'border-cyan-500/30',
    accent: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-950/60',
    accentHover: 'hover:bg-cyan-600',
    monacoTheme: 'vs-dark',
    editorBg: '#090e1e',
    glow: 'shadow-[0_0_25px_rgba(6,182,212,0.28)]',
    pillColor: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
    isDark: true
  },
  academic: {
    id: 'academic',
    name: 'Creative Scholar Studio',
    tagline: 'Deep royal sapphire & rich golden amber with crisp ivory glass architecture',
    badge: '🎓 Royal Scholar',
    bgPage: 'bg-[#f8fafc]',
    bgCard: 'bg-white text-slate-800',
    bgHeader: 'bg-white/95 text-slate-800',
    border: 'border-indigo-100',
    accent: 'bg-indigo-600',
    accentText: 'text-indigo-600',
    accentBg: 'bg-indigo-50',
    accentHover: 'hover:bg-indigo-700',
    monacoTheme: 'vs',
    editorBg: '#ffffff',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
    pillColor: 'bg-indigo-600 text-white'
  },
  emerald: {
    id: 'emerald',
    name: 'Bioluminescent Mint',
    tagline: 'Cyber-emerald & fresh spearmint on soft sage canvas promoting deep flow states',
    badge: '🌿 Bio-Emerald',
    bgPage: 'bg-[#f4f8f5]',
    bgCard: 'bg-white text-slate-800',
    bgHeader: 'bg-white/95 text-slate-800',
    border: 'border-emerald-200/70',
    accent: 'bg-emerald-600',
    accentText: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    accentHover: 'hover:bg-emerald-700',
    monacoTheme: 'vs',
    editorBg: '#fcfffc',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.18)]',
    pillColor: 'bg-emerald-600 text-white'
  },
  frost: {
    id: 'frost',
    name: 'Glacial Arctic Prism',
    tagline: 'Polar crystal cyan and arctic cobalt for maximum visual precision',
    badge: '❄️ Arctic Prism',
    bgPage: 'bg-[#f0f6fa]',
    bgCard: 'bg-white text-slate-800',
    bgHeader: 'bg-white/95 text-slate-800',
    border: 'border-sky-200',
    accent: 'bg-sky-600',
    accentText: 'text-sky-700',
    accentBg: 'bg-sky-50',
    accentHover: 'hover:bg-sky-700',
    monacoTheme: 'vs',
    editorBg: '#f8fafc',
    glow: 'shadow-[0_0_20px_rgba(2,132,199,0.18)]',
    pillColor: 'bg-sky-600 text-white'
  }
};

interface ThemeContextType {
  theme: AppTheme;
  themeConfig: ThemeConfig;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('cse_app_theme') as AppTheme;
    return saved && THEME_CONFIGS[saved] ? saved : 'academic';
  });

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem('cse_app_theme', t);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig: THEME_CONFIGS[theme],
        setTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
