import {
  eventMatchesSecond,
  eventRunsOnDate,
  localSecondKey,
  nextOccurrenceForEvent,
  sortedEventsByNextRun,
} from '@/lib/broadcast-scheduler';
import type { BroadcastSchedulerEvent } from '@/lib/types';

function makeEvent(overrides: Partial<BroadcastSchedulerEvent> = {}): BroadcastSchedulerEvent {
  return {
    id: 'event-1',
    name: 'Morning ID',
    assetId: 'asset-1',
    time: '08:00:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    mode: 'interrupt',
    enabled: true,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('broadcast scheduler helpers', () => {
  it('matches only the configured weekday and second', () => {
    const event = makeEvent();
    const mondayMatch = new Date(2026, 3, 13, 8, 0, 0);
    const mondayMiss = new Date(2026, 3, 13, 8, 0, 1);
    const sundayMiss = new Date(2026, 3, 12, 8, 0, 0);

    expect(eventRunsOnDate(event, mondayMatch)).toBe(true);
    expect(eventMatchesSecond(event, mondayMatch)).toBe(true);
    expect(eventMatchesSecond(event, mondayMiss)).toBe(false);
    expect(eventRunsOnDate(event, sundayMiss)).toBe(false);
    expect(eventMatchesSecond(event, sundayMiss)).toBe(false);
  });

  it('returns the next valid occurrence after the current time', () => {
    const weekdayEvent = makeEvent();
    const now = new Date(2026, 3, 13, 8, 0, 1);

    expect(nextOccurrenceForEvent(weekdayEvent, now)?.toISOString()).toBe(
      new Date(2026, 3, 14, 8, 0, 0).toISOString(),
    );

    const anyDayEvent = makeEvent({ daysOfWeek: [], time: '23:15:00' });
    const sameDayNow = new Date(2026, 3, 13, 22, 0, 0);

    expect(nextOccurrenceForEvent(anyDayEvent, sameDayNow)?.toISOString()).toBe(
      new Date(2026, 3, 13, 23, 15, 0).toISOString(),
    );
  });

  it('sorts enabled upcoming events ahead of disabled ones', () => {
    const now = new Date(2026, 3, 13, 7, 0, 0);
    const events = [
      makeEvent({ id: 'late', name: 'Late', time: '09:00:00' }),
      makeEvent({ id: 'early', name: 'Early', time: '08:00:00' }),
      makeEvent({ id: 'off', name: 'Off', enabled: false }),
    ];

    const sorted = sortedEventsByNextRun(events, now);

    expect(sorted.map((item) => item.event.id)).toEqual(['early', 'late', 'off']);
    expect(sorted[2]?.nextRun).toBeNull();
  });

  it('builds a stable second-level dedupe key', () => {
    expect(localSecondKey(new Date(2026, 3, 13, 8, 0, 5))).toBe('2026-3-13-8-0-5');
  });
});
