import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '@/lib/types';

export const CART_SLOT_COUNT = 12;

type CartState = {
  slots: (Track | null)[];
  setSlot: (index: number, track: Track | null) => void;
  clearSlot: (index: number) => void;
};

function emptySlots(): (Track | null)[] {
  return Array.from({ length: CART_SLOT_COUNT }, () => null);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      slots: emptySlots(),
      setSlot: (index, track) =>
        set((s) => {
          if (index < 0 || index >= CART_SLOT_COUNT) return s;
          const slots = [...s.slots];
          slots[index] = track;
          return { slots };
        }),
      clearSlot: (index) =>
        set((s) => {
          if (index < 0 || index >= CART_SLOT_COUNT) return s;
          const slots = [...s.slots];
          slots[index] = null;
          return { slots };
        }),
    }),
    { name: 'sonic-bloom-cart' }
  )
);
