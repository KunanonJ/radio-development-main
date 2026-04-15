import type { BroadcastSchedulerEvent } from '@/lib/types';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function safeParts(time: string) {
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

export function localSecondKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
}

export function eventRunsOnDate(event: BroadcastSchedulerEvent, date: Date) {
  const days = event.daysOfWeek;
  if (!days || days.length === 0) return true;
  return days.includes(date.getDay());
}

export function eventMatchesSecond(event: BroadcastSchedulerEvent, date: Date) {
  if (!event.enabled) return false;
  if (!eventRunsOnDate(event, date)) return false;
  const parts = safeParts(event.time);
  if (!parts) return false;
  return (
    date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute &&
    date.getSeconds() === parts.second
  );
}

export function nextOccurrenceForEvent(event: BroadcastSchedulerEvent, now: Date) {
  const parts = safeParts(event.time);
  if (!parts || !event.enabled) return null;
  const candidate = new Date(now.getTime());
  candidate.setMilliseconds(0);
  candidate.setHours(parts.hour, parts.minute, parts.second, 0);
  for (let i = 0; i < 8; i += 1) {
    const next = new Date(candidate.getTime());
    next.setDate(candidate.getDate() + i);
    if (!eventRunsOnDate(event, next)) continue;
    if (i === 0 && next.getTime() < now.getTime()) continue;
    return next;
  }
  return null;
}

export function sortedEventsByNextRun(events: BroadcastSchedulerEvent[], now: Date) {
  return events
    .map((event) => ({ event, nextRun: nextOccurrenceForEvent(event, now) }))
    .sort((a, b) => {
      if (a.nextRun == null && b.nextRun == null) return a.event.name.localeCompare(b.event.name);
      if (a.nextRun == null) return 1;
      if (b.nextRun == null) return -1;
      return a.nextRun.getTime() - b.nextRun.getTime();
    });
}
