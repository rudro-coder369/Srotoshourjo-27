'use client';

import React, { useState, useEffect } from 'react';
import { Plus, LogOut } from 'lucide-react';
import AuthGate, { UserRole } from '@/components/portal/AuthGate';
import StudentForm from '@/components/portal/StudentForm';
import StudentRepository from '@/components/portal/StudentRepository';
import SectionManager from '@/components/portal/SectionManager';

type ActiveTab = 'directory' | 'submit' | 'sections';

export default function StudentPortalPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('directory');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const savedRole = localStorage.getItem('portal_role') as UserRole | null;
    if (savedRole === 'guest' || savedRole === 'admin') {
      setRole(savedRole);
    }
    setHydrated(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('portal_role');
    setRole(null);
    setActiveTab('directory');
  };

  const handleSubmissionSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab('directory');
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!role) {
    return <AuthGate onLogin={(selectedRole) => setRole(selectedRole)} />;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-950 selection:bg-neutral-950 selection:text-white">
      {/* Apple / Notion Minimalist Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left: Brand + Tabs */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className="flex items-center gap-2 text-left cursor-pointer"
            >
              <span className="text-sm font-semibold tracking-tight text-neutral-950">
                Srotoshourjo &apos;27
              </span>
            </button>

            <nav className="hidden sm:flex items-center gap-1 h-14">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className={`relative flex h-full items-center px-3 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'directory'
                    ? 'text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-950'
                }`}
              >
                <span>Directory</span>
                {activeTab === 'directory' && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 bg-neutral-950" />
                )}
              </button>

              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sections')}
                  className={`relative flex h-full items-center px-3 text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'sections'
                      ? 'text-neutral-950'
                      : 'text-neutral-400 hover:text-neutral-950'
                  }`}
                >
                  <span>Sections</span>
                  {activeTab === 'sections' && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 bg-neutral-950" />
                  )}
                </button>
              )}
            </nav>
          </div>

          {/* Right: New Entry + Role/Exit */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('submit')}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'submit'
                  ? 'bg-neutral-200 text-neutral-950'
                  : 'bg-neutral-950 hover:bg-neutral-800 text-white'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Entry</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Exit"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 hover:border-neutral-950 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-950 transition-colors cursor-pointer"
            >
              <span className="font-mono text-[11px] capitalize">{role === 'guest' ? 'Student' : 'Admin'}</span>
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation */}
        <div className="flex sm:hidden border-t border-neutral-100 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`relative flex-1 py-2.5 text-xs font-medium cursor-pointer ${
              activeTab === 'directory' ? 'text-neutral-950' : 'text-neutral-400'
            }`}
          >
            Directory
            {activeTab === 'directory' && (
              <span className="absolute inset-x-8 bottom-0 h-0.5 bg-neutral-950" />
            )}
          </button>

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={`relative flex-1 py-2.5 text-xs font-medium cursor-pointer ${
                activeTab === 'sections' ? 'text-neutral-950' : 'text-neutral-400'
              }`}
            >
              Sections
              {activeTab === 'sections' && (
                <span className="absolute inset-x-8 bottom-0 h-0.5 bg-neutral-950" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {activeTab === 'directory' && (
          <StudentRepository role={role} refreshTrigger={refreshTrigger} />
        )}
        {activeTab === 'submit' && (
          <StudentForm onSuccess={handleSubmissionSuccess} />
        )}
        {activeTab === 'sections' && role === 'admin' && (
          <SectionManager
            onSectionsChange={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}
      </main>
    </div>
  );
}