import { useEffect } from 'react';
import { useLocalBroadcastStore } from '@/lib/local-broadcast-store';

/**
 * Global hotkeys: `1`–`9` play cart slots 1–9 (index 0–8) when not typing in an input.
 */
export function CartHotkeysBridge() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, number> = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3,
        Digit5: 4,
        Digit6: 5,
        Digit7: 6,
        Digit8: 7,
        Digit9: 8,
      };
      const slot = map[e.code];
      if (slot === undefined) return;
      e.preventDefault();
      useLocalBroadcastStore.getState().triggerCartSlot(slot);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
