import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';
import type { ReactNode } from 'react';

/**
 * In-app replacement for `window.confirm`.
 *
 * The Android WebView Capacitor ships does not implement `confirm()`: it
 * resolves `false` and never paints a dialog, so every destructive action
 * guarded by it (declining a request, cancelling a booking) silently did
 * nothing on the device.
 */
export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep',
  busy = false,
  onConfirm,
  onCancel,
  extra,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extra?: ReactNode;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-6">
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
          <AlertTriangle size={20} />
        </div>
        <h2 className="mt-3 text-base font-bold text-gray-900">{title}</h2>
        {message && <p className="mt-1 text-xs leading-relaxed text-gray-500 whitespace-pre-wrap">{message}</p>}
        {extra && <div className="mt-3">{extra}</div>}
        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy} className="flex-1 py-2.5 text-xs">
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy} className="flex-1 py-2.5 text-xs">
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};