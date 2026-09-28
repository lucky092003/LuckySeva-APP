import type { ComponentType } from 'react';
import * as Icons from 'lucide-react';

export const TYPE_ICON: Record<string, ComponentType<{ size?: number | string; className?: string }>> = {
  booking: Icons.CheckCircle2,
  provider: Icons.Truck,
  payment: Icons.Wallet,
  review: Icons.Star,
  offer: Icons.Percent,
  alert: Icons.AlertCircle,
  bell: Icons.Bell,
};

export const TYPE_TONE: Record<string, string> = {
  booking: 'bg-emerald-50 text-emerald-600',
  provider: 'bg-sky-50 text-sky-600',
  payment: 'bg-violet-50 text-violet-600',
  review: 'bg-amber-50 text-amber-600',
  offer: 'bg-pink-50 text-pink-600',
  alert: 'bg-red-50 text-red-600',
};
