import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/context/app-context';
import { useRefunds } from '@/hooks';
import { TopBar } from '@/components/PhoneShell';
import { Card, Spinner, EmptyState, Badge, Button } from '@/components/ui';
import { inr, formatDate } from '@/utils/format';

export const RefundsScreen = () => {
  const { refunds, loading, reload } = useRefunds();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="My Refunds" showBack />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-4 py-4">
        {loading ? (
          <Spinner className="py-16" />
        ) : refunds.length === 0 ? (
          <EmptyState
            icon={<Icons.Undo2 size={28} />}
            title="No refunds yet"
            subtitle="Your refund requests and their status will appear here."
          />
        ) : (
          <div className="space-y-3">
            {refunds.map((refund) => (
              <RefundCard key={refund.id} refund={refund} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RefundCard = ({ refund }: { refund: { id: string; booking_id: string | null; amount: number; status: string; reason: string; note: string; created_at: string } }) => {
  const statusConfig: Record<string, { tone: 'success' | 'warning' | 'info' | 'neutral'; label: string }> = {
    pending: { tone: 'warning', label: 'Pending' },
    completed: { tone: 'success', label: 'Refunded' },
    rejected: { tone: 'neutral', label: 'Rejected' },
    failed: { tone: 'neutral', label: 'Failed' },
  };
  const cfg = statusConfig[refund.status] || { tone: 'neutral' as const, label: refund.status };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{inr(refund.amount)}</p>
          <p className="text-[11px] text-gray-500">
            {refund.booking_id ? `Booking #${refund.booking_id.slice(0, 8)}` : 'Booking refund'}
          </p>
        </div>
        <Badge tone={cfg.tone}>{cfg.label}</Badge>
      </div>
      <div className="mt-3 border-t border-gray-50 pt-3">
        <p className="text-xs text-gray-600">{refund.reason}</p>
        {refund.note && (
          <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
            <span className="font-semibold">Admin note:</span> {refund.note}
          </p>
        )}
      </div>
      <p className="mt-2 text-[10px] text-gray-400">{formatDate(refund.created_at)}</p>
    </Card>
  );
};
