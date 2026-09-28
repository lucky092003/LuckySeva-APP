import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeDay, inr, slugToLabel, timeAgo } from './format';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('inr', () => {
  it('formats numbers as Indian rupees', () => {
    expect(inr(1000)).toBe('₹1,000');
    expect(inr(1234567)).toBe('₹12,34,567');
    expect(inr(0)).toBe('₹0');
  });

  it('handles missing or falsy input', () => {
    expect(inr(undefined as unknown as number)).toBe('₹0');
    expect(inr(null as unknown as number)).toBe('₹0');
  });
});

describe('slugToLabel', () => {
  it('converts slugs to readable labels', () => {
    expect(slugToLabel('home-cleaning')).toBe('Home Cleaning');
    expect(slugToLabel('ac-repair')).toBe('Ac Repair');
  });

  it('handles single word and empty slugs', () => {
    expect(slugToLabel('plumber')).toBe('Plumber');
    expect(slugToLabel('')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats ISO date to en-IN format', () => {
    expect(formatDate('2026-09-23')).toMatch(/^23 /);
    expect(formatDate('2026-09-23')).toContain('2026');
  });
});

describe('formatRelativeDay', () => {
  it('labels today, tomorrow and yesterday', () => {
    const today = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

    expect(formatRelativeDay(iso(today))).toBe('Today');

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    expect(formatRelativeDay(iso(tomorrow))).toBe('Tomorrow');

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    expect(formatRelativeDay(iso(yesterday))).toBe('Yesterday');
  });

  it('falls back to a date string for other days', () => {
    expect(formatRelativeDay('2020-01-01')).toMatch(/^1 /);
    expect(formatRelativeDay('2020-01-01')).toContain('2020');
  });
});

describe('timeAgo', () => {
  it('describes recent timestamps in minutes and hours', () => {
    expect(timeAgo(ago(30 * 1000))).toBe('Just now');
    expect(timeAgo(ago(1 * MINUTE))).toBe('1 min ago');
    expect(timeAgo(ago(5 * MINUTE))).toBe('5 mins ago');
    expect(timeAgo(ago(1 * HOUR))).toBe('1 hr ago');
    expect(timeAgo(ago(5 * HOUR))).toBe('5 hrs ago');
  });

  it('switches to days under a week and weeks beyond', () => {
    expect(timeAgo(ago(1 * DAY))).toBe('1 day ago');
    expect(timeAgo(ago(3 * DAY))).toBe('3 days ago');
    expect(timeAgo(ago(7 * DAY))).toBe('1 wk ago');
    expect(timeAgo(ago(21 * DAY))).toBe('3 wks ago');
  });

  it('treats future timestamps as just now', () => {
    expect(timeAgo(new Date(Date.now() + 5 * MINUTE).toISOString())).toBe('Just now');
  });
});
