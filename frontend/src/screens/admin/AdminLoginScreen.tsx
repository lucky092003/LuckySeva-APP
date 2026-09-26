import { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, LogOut, CheckCircle2 } from 'lucide-react';
import { Logo, Wordmark } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useApp } from '@/context/app-context';
import { api, setApiToken } from '@/services/api';

export const AdminLoginScreen = () => {
  const { adminAuthed, setAdminAuthed, navigate } = useApp();

  if (adminAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-4 flex justify-center">
            <Logo size={64} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin signed in</h1>
          <p className="mt-1 text-sm text-gray-500">You have full access to the LuckySeva platform.</p>
          <Button
            onClick={() => {
              setApiToken(null);
              setAdminAuthed(false);
              navigate({ name: 'admin-auth' });
            }}
            className="mt-6 w-full"
          >
            <LogOut size={18} /> Log out
          </Button>
          <button
            onClick={() => navigate({ name: 'admin-dashboard' })}
            className="mt-3 w-full text-center text-sm font-semibold text-emerald-600"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <AdminLoginForm />;
};

const AdminLoginForm = () => {
  const { setAdminAuthed, navigate } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim() && password;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.auth.verifyOtp({
        phone: username.trim(),
        code: password,
        role: 'admin',
      });
      setApiToken(res.access_token);
      setAdminAuthed(true);
      navigate({ name: 'admin-dashboard' });
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-700 p-10 text-white lg:flex">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <Logo size={44} />
            <Wordmark className="text-white" />
          </div>
          <div className="relative space-y-3">
            <h1 className="text-3xl font-extrabold leading-tight">
              Run the entire platform from one console.
            </h1>
            <p className="text-sm text-white/80">
              Manage customers, providers, services and bookings with real-time insights.
            </p>
            <ul className="space-y-2 pt-2 text-sm text-white/90">
              {['Live revenue & booking analytics', 'Provider & customer management', 'End-to-end booking oversight'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-200" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/50">LuckySeva Admin Console v1.0.0</p>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Logo size={40} />
              <Wordmark />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Admin Login</h2>
          <p className="mt-1 text-sm text-gray-500">Restricted access · LuckySeva platform</p>

          <div className="mt-8 space-y-4">
            <Field
              icon={<User size={18} />}
              placeholder="Username"
              value={username}
              onChange={(v) => setUsername(v)}
            />
            <Field
              icon={<Lock size={18} />}
              placeholder="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(v) => setPassword(v)}
              onEnter={canSubmit ? handleLogin : undefined}
              right={
                <button onClick={() => setShowPw(!showPw)} className="text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600">
                {error}
              </p>
            )}

            <Button onClick={handleLogin} disabled={!canSubmit || submitting} className="w-full">
              <ShieldCheck size={18} /> {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  right,
  onEnter,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  right?: React.ReactNode;
  onEnter?: () => void;
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
    <span className="text-gray-400">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
    />
    {right}
  </div>
);