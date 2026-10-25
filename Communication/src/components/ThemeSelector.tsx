import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles, BookOpen, Compass } from 'lucide-react';
import { useTheme, THEME_CONFIGS, AppTheme } from '../context/ThemeContext.js';

export const ThemeSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme, themeConfig } = useTheme();
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
    icon: string;
    colors: string[];
    tag: string;
  }> = [
    {
      id: 'aurora',
      title: 'Aurora Cyberwave',
      description: 'Luminous fuchsia, electric violet, and deep cosmic obsidian. High-octane creative energy.',
      icon: '🌌',
      colors: ['#8b5cf6', '#d946ef', '#0b0f19'],
      tag: 'Creative Neon'
    },
    {
      id: 'cyberpunk',
      title: 'Neon Synthwave',
      description: 'Electric laser cyan, tech teal, and deep dark matter contrast for futuristic sessions.',
      icon: '⚡',
      colors: ['#06b6d4', '#14b8a6', '#080d1a'],
      tag: 'Matrix Cyber'
    },
    {
      id: 'academic',
      title: 'Creative Scholar',
      description: 'Classic university aesthetic with royal sapphire & warm gold on ivory canvas.',
      icon: '🎓',
      colors: ['#4f46e5', '#3b82f6', '#f8fafc'],
      tag: 'Algorithmic Focus'
    },
    {
      id: 'emerald',
      title: 'Bio-Emerald Studio',
      description: 'Botanical sage & cyber-mint accents promoting calm, continuous problem solving.',
      icon: '🌿',
      colors: ['#059669', '#10b981', '#f4f8f5'],
      tag: 'Creative Flow'
    },
    {
      id: 'frost',
      title: 'Arctic Polar Prism',
      description: 'Crisp glacial slate with precision ice-cyan highlights. High technical clarity.',
      icon: '❄️',
      colors: ['#0284c7', '#06b6d4', '#f0f6fa'],
      tag: 'Clean Contrast'
    }
  ];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
          theme === 'aurora'
            ? 'bg-violet-900/50 text-fuchsia-300 border-violet-500/40 hover:bg-violet-800/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
            : theme === 'cyberpunk'
            ? 'bg-cyan-900/50 text-cyan-300 border-cyan-500/40 hover:bg-cyan-800/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
            : theme === 'emerald'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            : theme === 'frost'
            ? 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
            : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
        }`}
        title="Change Educational & Creative Theme"
      >
        <Palette className="w-3.5 h-3.5" />
        <span>{themeConfig.badge}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-3 text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Creative & Educational Themes
            </span>
          </div>

          <div className="space-y-2">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{t.icon}</span>
                      <span className="text-xs font-bold text-slate-800">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1">
                        {t.colors.map((c, i) => (
                          <span
                            key={i}
                            className="w-3 h-3 rounded-full border border-white shadow-2xs"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 font-bold" />}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-snug">{t.description}</p>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      {t.tag}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400">
            <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Theme persists across your browser sessions.</span>
          </div>
        </div>
      )}
    </div>
  );
};
