import { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useApp, ADMIN_CREDENTIALS } from '@/lib/app-context';

export const AdminLoginScreen = () => {
  const { adminAuthed, setAdminAuthed, setRole } = useApp();

  if (adminAuthed) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto bg-white px-6 pb-6 pt-10">
        <div className="mb-8 flex flex-col items-center">
          <Logo size={64} />
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Admin signed in</h1>
          <p className="mt-1 text-center text-sm text-gray-500">
            You have full access to the LuckySeva platform.
          </p>
        </div>
        <Button
          onClick={() => {
            setAdminAuthed(false);
            setRole('customer');
          }}
          className="w-full"
        >
          <LogOut size={18} /> Logout & go to Customer app
        </Button>
        <button
          onClick={() => setRole('admin')}
          className="mt-3 w-full text-center text-sm font-semibold text-emerald-600"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  return <AdminLoginForm />;
};

const AdminLoginForm = () => {
  const { setAdminAuthed, setRole } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = username.trim() && password;

  const handleLogin = () => {
    if (
      username.trim() === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      setError('');
      setAdminAuthed(true);
      setRole('admin');
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-white px-6 pb-6 pt-10">
      <div className="mb-8 flex flex-col items-center">
        <Logo size={64} />
        <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Admin Login</h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          Restricted access · LuckySeva platform
        </p>
      </div>

      <div className="space-y-4">
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

        <Button onClick={handleLogin} disabled={!canSubmit} className="w-full">
          <ShieldCheck size={18} /> Sign in
        </Button>

        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-center text-[11px] text-gray-500">
          Demo credentials — username: <b>admin</b> · password: <b>admin123</b>
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
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  right?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
    <span className="text-gray-400">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
    />
    {right}
  </div>
);
