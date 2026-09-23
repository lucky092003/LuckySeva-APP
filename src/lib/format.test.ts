import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeDay, inr, slugToLabel } from './format';

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