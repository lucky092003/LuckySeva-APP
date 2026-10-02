export const inr = (n: number) =>
  '₹' + Number(n || 0).toLocaleString('en-IN');

export const slugToLabel = (s: string) =>
  s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

/**
 * A bare `YYYY-MM-DD` string is parsed by `Date` as UTC midnight, so every
 * reader in a negative-offset timezone renders it a day early. Pin it to local
 * midnight instead, which is what a `date` column actually means.
 */
const parseLocalDate = (iso: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T00:00:00' : iso);

export const formatDate = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Local calendar day as `YYYY-MM-DD`, for `bookings.scheduled_date`.
 *
 * Do not reach for `toISOString().split('T')[0]` here: that converts to UTC
 * first, so between 00:00 and 05:29 IST — the whole overnight window for this
 * app's market — it hands back yesterday's date.
 */
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
};

export const formatRelativeDay = (iso: string) => {
  const d = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDate(iso);
};
