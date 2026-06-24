import { createContext, useContext, ReactNode } from 'react';

// Lightweight in-app navigation actions shared across screens so that a
// username rendered anywhere can open a profile, and a profile can start a DM.
export type NavValue = {
  openProfile: (userId: string) => void;
  openConversation: (userId: string) => void;
};

const NavContext = createContext<NavValue | undefined>(undefined);

export function NavProvider({ value, children }: { value: NavValue; children: ReactNode }) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within a NavProvider');
  return ctx;
}
