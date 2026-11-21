'use client';

import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

export type UserRole = 'guest' | 'admin';

interface AuthGateProps {
  onLogin: (role: UserRole) => void;
}

const ADMIN_EMAIL = 'souravkumar01986@gmail.com';
const ADMIN_PASS = 'rudro1234';

export default function AuthGate({ onLogin }: AuthGateProps) {
  const [mode, setMode] = useState<'student' | 'admin'>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
      password === ADMIN_PASS
    ) {
      localStorage.setItem('portal_role', 'admin');
      onLogin('admin');
    } else {
      setError('Invalid credentials.');
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('portal_role', 'guest');
    onLogin('guest');
  };

  return (
    <div className="min-h-screen w-full bg-white text-neutral-950 flex flex-col justify-between px-6 py-10 selection:bg-neutral-950 selection:text-white">
      {/* Top Minimal Wordmark */}
      <header className="mx-auto w-full max-w-sm flex items-center justify-between">
        <span className="text-xs font-medium tracking-tight text-neutral-950">
          Srotoshourjo &apos;27
        </span>
        <span className="text-xs text-neutral-400">Archive</span>
      </header>

      {/* Center Focused Entry */}
      <main className="mx-auto w-full max-w-sm my-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Batch Archive
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Directory &amp; Yearbook Repository
          </p>
        </div>

        {/* Apple-style Segmented Control */}
        <div className="grid grid-cols-2 rounded-full bg-neutral-100 p-1 mb-7">
          <button
            type="button"
            onClick={() => {
              setMode('student');
              setError('');
            }}
            className={`rounded-full py-1.5 text-xs font-medium transition-all cursor-pointer ${
              mode === 'student'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('admin');
              setError('');
            }}
            className={`rounded-full py-1.5 text-xs font-medium transition-all cursor-pointer ${
              mode === 'admin'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Admin
          </button>
        </div>

        {mode === 'student' ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGuestLogin}
              className="group w-full flex items-center justify-between rounded-full bg-neutral-950 hover:bg-neutral-800 px-6 py-3.5 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              <span>Enter Portal</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5">
            {error && (
              <p className="text-xs text-neutral-950 border border-neutral-300 bg-neutral-50 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-neutral-200 bg-white pl-4 pr-10 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-950 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-950 hover:bg-neutral-800 py-3.5 text-sm font-medium text-white transition-colors cursor-pointer mt-2"
            >
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </main>

      {/* Bottom Hairline Footer */}
      <footer className="mx-auto w-full max-w-sm border-t border-neutral-100 pt-4 flex items-center justify-between text-[11px] text-neutral-400">
        <span>Class of 2027</span>
        <span>Official Repository</span>
      </footer>
    </div>
  );
}