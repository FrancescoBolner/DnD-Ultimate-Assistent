import { useContext } from 'react';
import { UIContext, type UIState } from './UIContext';

export function useUI(): UIState {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

export type { UIState };
