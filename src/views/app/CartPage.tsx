"use client";

import { useMemo } from 'react';
import { Disc3, Play, Trash2 } from 'lucide-react';
import { useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLOR_OPTIONS = [
  'bg-emerald-500/20 border-emerald-400/50',
  'bg-cyan-500/20 border-cyan-400/50',
  'bg-amber-500/20 border-amber-400/50',
  'bg-fuchsia-500/20 border-fuchsia-400/50',
  'bg-blue-500/20 border-blue-400/50',
  'bg-rose-500/20 border-rose-400/50',
];

export default function CartPage() {
  const assets = useLocalBroadcastStore((state) => state.assets);
  const cartSlots = useLocalBroadcastStore((state) => state.cartSlots);
  const setCartSlotAsset = useLocalBroadcastStore((state) => state.setCartSlotAsset);
  const updateCartSlot = useLocalBroadcastStore((state) => state.updateCartSlot);
  const triggerCartSlot = useLocalBroadcastStore((state) => state.triggerCartSlot);

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        id: asset.id,
        label: `${asset.title} (${Math.round(asset.durationSec)}s)`,
      })),
    [assets],
  );

  const assetTitleById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.title])),
    [assets],
  );

  return (
    <div className="app-page-cart space-y-6">
      <div className="flex items-center gap-3">
        <Disc3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cart configuration</h1>
          <p className="text-sm text-muted-foreground">
            The live wall on the console reads from these 12 slots. Slots 1–9 also respond to number keys.
          </p>
        </div>
      </div>

      {assets.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Import local audio on the broadcast console before assigning cart slots.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {cartSlots.map((slot) => (
          <div
            key={slot.slotIndex}
            className={`rounded-xl border p-4 ${slot.color}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Slot {slot.slotIndex + 1}
                  {slot.hotkey ? ` · Hotkey ${slot.hotkey}` : ''}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {slot.assetId ? assetTitleById.get(slot.assetId) ?? slot.label : 'Unassigned'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!slot.assetId}
                  onClick={() => triggerCartSlot(slot.slotIndex)}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Fire
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!slot.assetId}
                  onClick={() => void setCartSlotAsset(slot.slotIndex, null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Slot label</label>
                <Input
                  value={slot.label}
                  onChange={(event) =>
                    void updateCartSlot(slot.slotIndex, { label: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Assigned asset</label>
                  <Select
                    value={slot.assetId ?? '__none'}
                    onValueChange={(value) =>
                      void setCartSlotAsset(
                        slot.slotIndex,
                        value === '__none' ? null : value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select local audio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Unassigned</SelectItem>
                      {assetOptions.map((asset) => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <Select
                    value={slot.color}
                    onValueChange={(value) => void updateCartSlot(slot.slotIndex, { color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((colorClass, index) => (
                        <SelectItem key={colorClass} value={colorClass}>
                          Color {index + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
