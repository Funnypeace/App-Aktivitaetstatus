import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

import { supabase } from './supabase';

export type ThemeName = 'light' | 'dark';

export type ThemeColors = {
  background: string; // app background
  card: string; // surfaces (cards, rows, inputs)
  cardAlt: string; // subtle alternate surface
  border: string;
  text: string; // primary text
  textMuted: string; // secondary text
  primary: string; // accent / buttons
  primaryText: string; // text on primary
  online: string;
  offline: string;
  danger: string;
  success: string;
  chipBg: string;
  chipText: string;
  bubbleMine: string;
  bubbleMineText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  overlay: string;
  tabBar: string;
  tabInactive: string;
};

const light: ThemeColors = {
  background: '#f3f4f6',
  card: '#ffffff',
  cardAlt: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  primary: '#4f46e5',
  primaryText: '#ffffff',
  online: '#22c55e',
  offline: '#9ca3af',
  danger: '#dc2626',
  success: '#047857',
  chipBg: '#eef2ff',
  chipText: '#4338ca',
  bubbleMine: '#4f46e5',
  bubbleMineText: '#ffffff',
  bubbleOther: '#e5e7eb',
  bubbleOtherText: '#111827',
  overlay: 'rgba(0,0,0,0.4)',
  tabBar: '#ffffff',
  tabInactive: '#9ca3af',
};

const dark: ThemeColors = {
  background: '#0b1120',
  card: '#161e2e',
  cardAlt: '#1f2937',
  border: '#374151',
  text: '#f3f4f6',
  textMuted: '#9ca3af',
  primary: '#6366f1',
  primaryText: '#ffffff',
  online: '#22c55e',
  offline: '#6b7280',
  danger: '#f87171',
  success: '#34d399',
  chipBg: '#312e81',
  chipText: '#c7d2fe',
  bubbleMine: '#6366f1',
  bubbleMineText: '#ffffff',
  bubbleOther: '#374151',
  bubbleOtherText: '#f3f4f6',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: '#161e2e',
  tabInactive: '#6b7280',
};

export const PALETTES: Record<ThemeName, ThemeColors> = { light, dark };

type ThemeContextValue = {
  name: ThemeName;
  colors: ThemeColors;
  setTheme: (name: ThemeName, userId?: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  initial = 'light',
  children,
}: {
  initial?: ThemeName;
  children: ReactNode;
}) {
  const [name, setName] = useState<ThemeName>(initial);

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: PALETTES[name],
      setTheme: async (next, userId) => {
        setName(next); // optimistic
        if (userId) {
          await supabase.from('profiles').update({ theme: next }).eq('id', userId);
        }
      },
    }),
    [name]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
