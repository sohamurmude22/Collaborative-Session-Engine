import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme =
  | 'linear-dark'
  | 'vercel-light'
  | 'cyber-dark'
  | 'aurora-dark'
  | 'academic-light'
  | 'emerald-dark'
  // Legacy aliases for backward compatibility with existing saved themes
  | 'aurora'
  | 'cyberpunk'
  | 'academic'
  | 'emerald'
  | 'frost';

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
  isDark: boolean;
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  'linear-dark': {
    id: 'linear-dark',
    name: 'Linear Midnight',
    tagline: 'Deep charcoal obsidian with precision electric indigo & violet accents',
    badge: '⚡ Linear Dark',
    bgPage: 'bg-[#090d16]',
    bgCard: 'bg-[#0f172a]/85 text-slate-100',
    bgHeader: 'bg-[#090d16]/90 text-slate-100',
    border: 'border-white/[0.08]',
    accent: 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600',
    accentText: 'text-indigo-400',
    accentBg: 'bg-indigo-950/50',
    accentHover: 'hover:bg-indigo-500',
    monacoTheme: 'vs-dark',
    editorBg: '#090d16',
    glow: 'shadow-[0_0_25px_rgba(99,102,241,0.25)]',
    pillColor: 'bg-indigo-600 text-white',
    isDark: true
  },
  'vercel-light': {
    id: 'vercel-light',
    name: 'Vercel Snow',
    tagline: 'Crisp porcelain canvas with high-contrast slate typography and cobalt focus',
    badge: '⚪ Vercel Light',
    bgPage: 'bg-[#f8fafc]',
    bgCard: 'bg-white text-slate-800',
    bgHeader: 'bg-white/95 text-slate-800',
    border: 'border-slate-200/90',
    accent: 'bg-indigo-600',
    accentText: 'text-indigo-600',
    accentBg: 'bg-indigo-50',
    accentHover: 'hover:bg-indigo-700',
    monacoTheme: 'vs',
    editorBg: '#ffffff',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
    pillColor: 'bg-indigo-600 text-white',
    isDark: false
  },
  'cyber-dark': {
    id: 'cyber-dark',
    name: 'Neon Synthwave',
    tagline: 'High-contrast cyan lasers, hyper teal and dark matrix obsidian vibes',
    badge: '🌌 Cyber Matrix',
    bgPage: 'bg-[#060a12]',
    bgCard: 'bg-[#0b1220]/90 text-slate-100',
    bgHeader: 'bg-[#080d1a]/95 text-slate-100',
    border: 'border-cyan-500/25',
    accent: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-950/60',
    accentHover: 'hover:bg-cyan-500',
    monacoTheme: 'vs-dark',
    editorBg: '#070c18',
    glow: 'shadow-[0_0_25px_rgba(6,182,212,0.28)]',
    pillColor: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
    isDark: true
  },
  'aurora-dark': {
    id: 'aurora-dark',
    name: 'Aurora Cyberwave',
    tagline: 'Vibrant neon fuchsia, electric violet, and deep cosmic obsidian',
    badge: '🔮 Aurora Violet',
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
  'emerald-dark': {
    id: 'emerald-dark',
    name: 'Bioluminescent Carbon',
    tagline: 'Emerald & cyber-mint accents on deep obsidian promoting uninterrupted flow states',
    badge: '🌿 Bio Emerald',
    bgPage: 'bg-[#060f0d]',
    bgCard: 'bg-[#091b16]/90 text-slate-100',
    bgHeader: 'bg-[#071410]/95 text-slate-100',
    border: 'border-emerald-500/25',
    accent: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-950/60',
    accentHover: 'hover:bg-emerald-600',
    monacoTheme: 'vs-dark',
    editorBg: '#081612',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.25)]',
    pillColor: 'bg-emerald-600 text-white',
    isDark: true
  },
  'academic-light': {
    id: 'academic-light',
    name: 'Creative Scholar',
    tagline: 'Deep royal sapphire & warm gold on ivory canvas for algorithmic focus',
    badge: '🎓 Royal Scholar',
    bgPage: 'bg-[#f4f6fb]',
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
    pillColor: 'bg-indigo-600 text-white',
    isDark: false
  },

  // Backward compatibility mappings
  aurora: {
    id: 'aurora',
    name: 'Aurora Cyberwave',
    tagline: 'Vibrant neon fuchsia, electric violet, and deep cosmic obsidian',
    badge: '🔮 Aurora Violet',
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
    tagline: 'High-contrast cyan lasers, tech teal and dark matrix contrast',
    badge: '🌌 Cyber Matrix',
    bgPage: 'bg-[#060a12]',
    bgCard: 'bg-[#0b1220]/90 text-slate-100',
    bgHeader: 'bg-[#080d1a]/95 text-slate-100',
    border: 'border-cyan-500/30',
    accent: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500',
    accentText: 'text-cyan-400',
    accentBg: 'bg-cyan-950/60',
    accentHover: 'hover:bg-cyan-600',
    monacoTheme: 'vs-dark',
    editorBg: '#070c18',
    glow: 'shadow-[0_0_25px_rgba(6,182,212,0.28)]',
    pillColor: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
    isDark: true
  },
  academic: {
    id: 'academic',
    name: 'Creative Scholar',
    tagline: 'Deep royal sapphire & warm gold on ivory canvas',
    badge: '🎓 Royal Scholar',
    bgPage: 'bg-[#f4f6fb]',
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
    pillColor: 'bg-indigo-600 text-white',
    isDark: false
  },
  emerald: {
    id: 'emerald',
    name: 'Bioluminescent Carbon',
    tagline: 'Cyber-emerald & fresh mint on deep carbon canvas',
    badge: '🌿 Bio-Emerald',
    bgPage: 'bg-[#060f0d]',
    bgCard: 'bg-[#091b16]/90 text-slate-100',
    bgHeader: 'bg-[#071410]/95 text-slate-100',
    border: 'border-emerald-500/25',
    accent: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    accentText: 'text-emerald-400',
    accentBg: 'bg-emerald-950/60',
    accentHover: 'hover:bg-emerald-600',
    monacoTheme: 'vs-dark',
    editorBg: '#081612',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.25)]',
    pillColor: 'bg-emerald-600 text-white',
    isDark: true
  },
  frost: {
    id: 'frost',
    name: 'Vercel Snow',
    tagline: 'Polar crystal cyan and arctic cobalt for maximum visual precision',
    badge: '⚪ Vercel Light',
    bgPage: 'bg-[#f8fafc]',
    bgCard: 'bg-white text-slate-800',
    bgHeader: 'bg-white/95 text-slate-800',
    border: 'border-slate-200',
    accent: 'bg-sky-600',
    accentText: 'text-sky-700',
    accentBg: 'bg-sky-50',
    accentHover: 'hover:bg-sky-700',
    monacoTheme: 'vs',
    editorBg: '#f8fafc',
    glow: 'shadow-[0_0_20px_rgba(2,132,199,0.18)]',
    pillColor: 'bg-sky-600 text-white',
    isDark: false
  }
};

interface ThemeContextType {
  theme: AppTheme;
  themeConfig: ThemeConfig;
  isDark: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('cse_app_theme') as AppTheme;
    return saved && THEME_CONFIGS[saved] ? saved : 'linear-dark';
  });

  const activeConfig = THEME_CONFIGS[theme] || THEME_CONFIGS['linear-dark'];
  const isDark = activeConfig.isDark ?? true;

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
    localStorage.setItem('cse_app_theme', t);
  };

  const toggleDarkMode = () => {
    if (isDark) {
      setTheme('vercel-light');
    } else {
      setTheme('linear-dark');
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isDark]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig: activeConfig,
        isDark,
        setTheme,
        toggleDarkMode
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
