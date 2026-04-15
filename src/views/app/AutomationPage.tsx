"use client";

import { useMemo, useState } from 'react';
import { CalendarClock, Play, Trash2 } from 'lucide-react';
import { sortedEventsByNextRun } from '@/lib/broadcast-scheduler';
import { useLocalBroadcastStore } from '@/lib/local-broadcast-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

export default function AutomationPage() {
  const [name, setName] = useState('');
  const [assetId, setAssetId] = useState<string>('');
  const [time, setTime] = useState('08:00:00');
  const [mode, setMode] = useState<'interrupt' | 'queue-complete'>('interrupt');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const assets = useLocalBroadcastStore((state) => state.assets);
  const schedulerEvents = useLocalBroadcastStore((state) => state.schedulerEvents);
  const runtime = useLocalBroadcastStore((state) => state.runtime);
  const addSchedulerEvent = useLocalBroadcastStore((state) => state.addSchedulerEvent);
  const updateSchedulerEvent = useLocalBroadcastStore((state) => state.updateSchedulerEvent);
  const removeSchedulerEvent = useLocalBroadcastStore((state) => state.removeSchedulerEvent);
  const runSchedulerEventNow = useLocalBroadcastStore((state) => state.runSchedulerEventNow);

  const sortedEvents = useMemo(
    () => sortedEventsByNextRun(schedulerEvents, new Date()),
    [schedulerEvents],
  );

  const assetLabelById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset.title])),
    [assets],
  );

  const allDaysSelected = daysOfWeek.length === 7;

  return (
    <div className="app-page-narrow space-y-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scheduler</h1>
          <p className="text-sm text-muted-foreground">
            Schedule recurring interrupt or queue-complete launches with second-level timing.
          </p>
        </div>
      </div>

      <form
        className="surface-2 rounded-xl border border-border p-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!assetId) return;
          await addSchedulerEvent({
            name: name.trim() || assetLabelById.get(assetId) || 'Scheduled event',
            assetId,
            time,
            daysOfWeek: allDaysSelected ? [] : daysOfWeek,
            mode,
            enabled: true,
          });
          setName('');
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Event name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="National anthem" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Audio asset</label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select local audio" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Time</label>
            <Input value={time} onChange={(event) => setTime(event.target.value)} pattern="\d{2}:\d{2}:\d{2}" placeholder="08:00:00" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Launch behavior</label>
            <Select value={mode} onValueChange={(value) => setMode(value as 'interrupt' | 'queue-complete')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interrupt">Interrupt current audio</SelectItem>
                <SelectItem value="queue-complete">Wait for current track to finish</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Days of week</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const selected = daysOfWeek.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                  onClick={() =>
                    setDaysOfWeek((previous) =>
                      previous.includes(day.id)
                        ? previous.filter((value) => value !== day.id)
                        : [...previous, day.id].sort((a, b) => a - b),
                    )
                  }
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {allDaysSelected ? 'Runs every day.' : 'Only the highlighted days will fire.'}
          </p>
        </div>

        <Button type="submit" disabled={!assetId}>
          Add event
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Upcoming events</h2>
        {sortedEvents.length === 0 ? (
          <div className="surface-2 rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            No scheduled events yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map(({ event, nextRun }) => {
              const pending = runtime.pendingEventIds.includes(event.id);
              return (
                <div
                  key={event.id}
                  className={`surface-2 rounded-xl border px-4 py-4 ${
                    event.enabled ? 'border-border' : 'border-border/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {assetLabelById.get(event.assetId) || 'Missing asset'} · {event.mode === 'interrupt' ? 'Interrupt' : 'Queue complete'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nextRun ? nextRun.toLocaleString() : 'No upcoming run'}
                        {pending ? ' · Waiting in queue' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                        <span className="text-xs text-muted-foreground">Enabled</span>
                        <Switch
                          checked={event.enabled}
                          onCheckedChange={(checked) => void updateSchedulerEvent(event.id, { enabled: checked })}
                        />
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => runSchedulerEventNow(event.id)}>
                        <Play className="mr-2 h-4 w-4" />
                        Run now
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => void removeSchedulerEvent(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
