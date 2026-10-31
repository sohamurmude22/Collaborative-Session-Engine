import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles, Moon, Sun, Laptop } from 'lucide-react';
import { useTheme, AppTheme } from '../context/ThemeContext.js';

export const ThemeSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme, themeConfig, isDark, toggleDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themes: Array<{
    id: AppTheme;
    title: string;
    description: string;
    isDark: boolean;
    colors: string[];
    tag: string;
  }> = [
    {
      id: 'linear-dark',
      title: 'Linear Midnight',
      description: 'Deep obsidian charcoal with precision electric indigo & violet accents.',
      isDark: true,
      colors: ['#090d16', '#6366f1', '#8b5cf6'],
      tag: 'Default Dark'
    },
    {
      id: 'cyber-dark',
      title: 'Neon Synthwave',
      description: 'Electric laser cyan, tech teal, and deep dark matter contrast.',
      isDark: true,
      colors: ['#060a12', '#06b6d4', '#14b8a6'],
      tag: 'Matrix Cyber'
    },
    {
      id: 'aurora-dark',
      title: 'Aurora Cyberwave',
      description: 'Luminous fuchsia, electric violet, and cosmic obsidian energy.',
      isDark: true,
      colors: ['#0b0f19', '#d946ef', '#8b5cf6'],
      tag: 'Creative Neon'
    },
    {
      id: 'emerald-dark',
      title: 'Bio-Emerald Carbon',
      description: 'Botanical emerald & cyber-mint accents promoting flow state.',
      isDark: true,
      colors: ['#060f0d', '#10b981', '#059669'],
      tag: 'Deep Focus'
    },
    {
      id: 'vercel-light',
      title: 'Vercel Snow',
      description: 'Crisp porcelain canvas with high-contrast slate typography.',
      isDark: false,
      colors: ['#f8fafc', '#4f46e5', '#0f172a'],
      tag: 'Clean Light'
    },
    {
      id: 'academic-light',
      title: 'Creative Scholar',
      description: 'University research aesthetic with sapphire & warm gold on ivory.',
      isDark: false,
      colors: ['#f4f6fb', '#3b82f6', '#4f46e5'],
      tag: 'Scholar Ivory'
    }
  ];

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={dropdownRef}>
      {/* 1-Click Dark/Light Mode Quick Toggle */}
      <button
        onClick={toggleDarkMode}
        className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all hover:scale-105 cursor-pointer"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle Dark and Light Mode"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>

      {/* Theme Palette Picker Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/5 hover:bg-slate-200/80 dark:hover:bg-white/10 text-xs font-medium text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
        title="Choose Theme Style"
      >
        <Palette className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
        {!compact && <span className="hidden sm:inline font-sans">{themeConfig.name}</span>}
      </button>

      {/* Theme Palette Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 shadow-2xl z-50 p-3 text-slate-800 dark:text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-white/10">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Theme & Aesthetic
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
            {themes.map((t) => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                      : 'border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Color Swatch Dots */}
                    <div className="flex -space-x-1 mt-1 shrink-0">
                      {t.colors.map((c, i) => (
                        <span
                          key={i}
                          className="w-3 h-3 rounded-full ring-1 ring-white/20 shadow-xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                          {t.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-medium">
                          {t.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-1">
                        {t.description}
                      </p>
                    </div>
                  </div>

                  {isActive && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-600/30">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
