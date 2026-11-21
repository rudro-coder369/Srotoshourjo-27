'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'student' | 'admin';

export interface AuthUserInfo {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthGateProps {
  onLogin: (userInfo: AuthUserInfo) => void;
}

const ADMIN_EMAIL = 'souravkumar01986@gmail.com';

export default function AuthGate({ onLogin }: AuthGateProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const resolveUser = (user: User): AuthUserInfo => {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    return {
      id: user.id,
      email: cleanEmail,
      role: cleanEmail === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'student',
    };
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) {
        onLogin(resolveUser(data.session.user));
      }
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        onLogin(resolveUser(session.user));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 6) {
      setError('Enter a valid email and at least 6 characters password.');
      return;
    }

    setLoading(true);

    if (mode === 'signin') {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else if (data.user) {
        onLogin(resolveUser(data.user));
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session?.user) {
        onLogin(resolveUser(data.session.user));
      } else {
        setMessage('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
      }
    }

    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

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
            {mode === 'signin' ? 'Batch Archive' : 'Create Account'}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {mode === 'signin'
              ? 'Sign in with your email to access & edit your entry'
              : 'Register with your email to add your yearbook profile'}
          </p>
        </div>

        {/* Apple-style Segmented Control */}
        <div className="grid grid-cols-2 rounded-full bg-neutral-100 p-1 mb-7">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError('');
              setMessage('');
            }}
            className={`rounded-full py-1.5 text-xs font-medium transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError('');
              setMessage('');
            }}
            className={`rounded-full py-1.5 text-xs font-medium transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-white text-neutral-950 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <p className="text-xs text-neutral-950 border border-neutral-950 bg-neutral-50 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          {message && (
            <p className="text-xs text-neutral-800 border border-neutral-300 bg-neutral-50 rounded-xl px-3.5 py-2.5">
              {message}
            </p>
          )}

          <div>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
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
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 py-3.5 text-sm font-medium text-white transition-colors cursor-pointer mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </main>

      {/* Bottom Hairline Footer */}
      <footer className="mx-auto w-full max-w-sm border-t border-neutral-100 pt-4 flex items-center justify-between text-[11px] text-neutral-400">
        <span>Class of 2027</span>
        <span>1 Entry Per Email</span>
      </footer>
    </div>
  );
}