'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Trash2,
  X,
  Loader2,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOptimizedPhotoUrl } from '@/lib/cloudinary';
import { Student, Section, BloodGroup } from '@/types/student';
import { UserRole } from './AuthGate';

interface StudentRepositoryProps {
  role: UserRole;
  refreshTrigger: number;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function StudentRepository({
  role,
  refreshTrigger,
}: StudentRepositoryProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'roll' | 'name' | 'newest'>('roll');

  // Modal, Copy & Delete states
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, sectionsRes] = await Promise.all([
      supabase
        .from('students')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('sections')
        .select('*')
        .order('display_order', { ascending: true }),
    ]);

    if (!studentsRes.error && studentsRes.data) {
      setStudents(studentsRes.data as Student[]);
    }
    if (!sectionsRes.error && sectionsRes.data) {
      setSections(sectionsRes.data as Section[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setActiveStudent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: students.length };
    students.forEach((s) => {
      counts[s.section_name] = (counts[s.section_name] || 0) + 1;
    });
    return counts;
  }, [students]);

  // Detect smart search mode: numeric -> Roll, matching section -> Section, text -> Name/Section
  const searchIntent = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
      return { type: 'roll' as const, normalized: String(parseInt(raw, 10)) };
    }

    const q = raw.toLowerCase();
    const matchesSection = sections.some((s) =>
      s.name.toLowerCase().includes(q)
    );
    if (matchesSection) {
      return { type: 'section' as const, query: q };
    }

    return { type: 'name' as const, query: q };
  }, [searchQuery, sections]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((student) => {
        if (selectedSection !== 'ALL' && student.section_name !== selectedSection) {
          return false;
        }
        if (selectedBloodGroup !== 'ALL' && student.blood_group !== selectedBloodGroup) {
          return false;
        }

        if (searchIntent) {
          if (searchIntent.type === 'roll') {
            const studentRoll = String(
              parseInt(student.roll.trim(), 10) || student.roll.trim()
            );
            return (
              studentRoll === searchIntent.normalized ||
              studentRoll.startsWith(searchIntent.normalized)
            );
          }

          if (searchIntent.type === 'section') {
            return (
              student.section_name.toLowerCase().includes(searchIntent.query) ||
              student.name.toLowerCase().includes(searchIntent.query)
            );
          }

          return (
            student.name.toLowerCase().includes(searchIntent.query) ||
            student.section_name.toLowerCase().includes(searchIntent.query)
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'roll') {
          return a.roll.localeCompare(b.roll, undefined, { numeric: true });
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [students, searchIntent, selectedSection, selectedBloodGroup, sortBy]);

  const handleDelete = async (e: React.MouseEvent, student: Student) => {
    e.stopPropagation();
    if (role !== 'admin') return;

    const confirmed = window.confirm(
      `Remove "${student.name}" (Roll ${student.roll})?`
    );
    if (!confirmed) return;

    setDeletingId(student.id);
    const { error } = await supabase.from('students').delete().eq('id', student.id);

    if (error) {
      alert(error.message);
    } else {
      setStudents((prev) => prev.filter((item) => item.id !== student.id));
      if (activeStudent?.id === student.id) {
        setActiveStudent(null);
      }
    }
    setDeletingId(null);
  };

  const handleCopyPhone = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 1800);
  };

  const formatWhatsAppLink = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const formatted = digits.startsWith('01') ? `88${digits}` : digits;
    return `https://wa.me/${formatted}`;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSection('ALL');
    setSelectedBloodGroup('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedSection !== 'ALL' || selectedBloodGroup !== 'ALL';

  return (
    <div className="space-y-8 text-neutral-950">
      {/* Minimal Header + Smart Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, roll number, or section..."
              className="w-full rounded-full border border-neutral-200 bg-white pl-11 pr-28 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
            />

            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchIntent && (
                <span className="rounded-full bg-neutral-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
                  {searchIntent.type}
                </span>
              )}
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="rounded-full p-1 text-neutral-400 hover:text-neutral-950 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden sm:inline-block rounded-md border border-neutral-200 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Minimal Selectors */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              aria-label="Filter by blood group"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-medium text-neutral-950 focus:border-neutral-950 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Blood: All</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'roll' | 'name' | 'newest')}
              aria-label="Sort directory"
              className="rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-xs font-medium text-neutral-950 focus:border-neutral-950 focus:outline-none cursor-pointer"
            >
              <option value="roll">Sort: Roll</option>
              <option value="name">Sort: Name</option>
              <option value="newest">Sort: Recent</option>
            </select>
          </div>
        </div>

        {/* Section Filter Pills + Count */}
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedSection('ALL')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                selectedSection === 'ALL'
                  ? 'bg-neutral-950 text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
              }`}
            >
              All <span className="font-mono opacity-70 ml-1">{sectionCounts.ALL || 0}</span>
            </button>

            {sections.map((sec) => {
              const active = selectedSection === sec.name;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSelectedSection(sec.name)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-neutral-950 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
                  }`}
                >
                  {sec.name}{' '}
                  <span className="font-mono opacity-70 ml-1">
                    {sectionCounts[sec.name] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="shrink-0 flex items-center gap-3 text-xs">
            <span className="font-mono text-neutral-400">
              {filteredStudents.length}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-medium text-neutral-950 underline underline-offset-4 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Directory Grid (Notion Hairline Table-Grid Style) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-neutral-200 rounded-2xl overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="border-r border-b border-neutral-200 bg-white p-6 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-neutral-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-20 rounded bg-neutral-100" />
                  <div className="h-4 w-32 rounded bg-neutral-100" />
                </div>
              </div>
              <div className="h-10 rounded-lg bg-neutral-50" />
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 py-20 text-center space-y-3">
          <p className="text-sm font-medium text-neutral-950">No matching profiles</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-neutral-200 rounded-2xl overflow-hidden bg-white">
          {filteredStudents.map((student) => (
            <article
              key={student.id}
              onClick={() => setActiveStudent(student)}
              className="group flex flex-col justify-between border-r border-b border-neutral-200 bg-white hover:bg-neutral-50/80 p-6 transition-colors cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-4">
                  <img
                    src={getOptimizedPhotoUrl(student.photo_url, 320)}
                    alt={student.name}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-2xl object-cover border border-neutral-200 grayscale-15 group-hover:grayscale-0 transition-all"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-neutral-500 truncate">
                        {student.section_name}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="font-mono font-medium text-neutral-950">
                        {student.roll}
                      </span>
                      {student.blood_group && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span className="font-mono text-[11px] font-semibold text-neutral-950">
                            {student.blood_group}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="mt-1 text-base font-semibold tracking-tight text-neutral-950 truncate">
                      {student.name}
                    </h3>

                    {student.whatsapp_number && (
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
                        <span className="font-mono text-[11px]">{student.whatsapp_number}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyPhone(e, student.whatsapp_number!)}
                          title="Copy"
                          className="p-0.5 text-neutral-400 hover:text-neutral-950 cursor-pointer"
                        >
                          {copiedPhone === student.whatsapp_number ? (
                            <Check className="h-3 w-3 text-neutral-950" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {student.personal_story && (
                  <p className="mt-4 text-xs text-neutral-500 leading-relaxed line-clamp-2">
                    &ldquo;{student.personal_story}&rdquo;
                  </p>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                <div
                  className="flex items-center gap-3 font-medium text-neutral-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  {student.fb_link && (
                    <a
                      href={student.fb_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-neutral-950 transition-colors"
                    >
                      <span>Facebook</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                  {student.insta_link && (
                    <a
                      href={student.insta_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-neutral-950 transition-colors"
                    >
                      <span>Instagram</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {role === 'admin' ? (
                  <button
                    type="button"
                    disabled={deletingId === student.id}
                    onClick={(e) => handleDelete(e, student)}
                    className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-950 transition-colors cursor-pointer"
                  >
                    {deletingId === student.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    <span>Remove</span>
                  </button>
                ) : (
                  <span className="text-neutral-400 group-hover:text-neutral-950 transition-colors">
                    View
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Apple-Style Minimalist Profile Modal */}
      {activeStudent && (
        <div
          onClick={() => setActiveStudent(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto space-y-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={getOptimizedPhotoUrl(activeStudent.photo_url, 450)}
                  alt={activeStudent.name}
                  className="h-20 w-20 rounded-2xl object-cover border border-neutral-200"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-500">{activeStudent.section_name}</span>
                    <span className="text-neutral-300">·</span>
                    <span className="font-mono font-medium text-neutral-950">
                      Roll {activeStudent.roll}
                    </span>
                    {activeStudent.blood_group && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="rounded bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                          {activeStudent.blood_group}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-neutral-950">
                    {activeStudent.name}
                  </h3>

                  {activeStudent.whatsapp_number && (
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={formatWhatsAppLink(activeStudent.whatsapp_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-neutral-600 hover:text-neutral-950 underline underline-offset-4"
                      >
                        {activeStudent.whatsapp_number}
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleCopyPhone(e, activeStudent.whatsapp_number!)}
                        className="text-[11px] text-neutral-400 hover:text-neutral-950 cursor-pointer"
                      >
                        {copiedPhone === activeStudent.whatsapp_number ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="rounded-full border border-neutral-200 p-2 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeStudent.personal_story && (
              <div className="border-t border-neutral-100 pt-5">
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  &ldquo;{activeStudent.personal_story}&rdquo;
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                {activeStudent.fb_link && (
                  <a
                    href={activeStudent.fb_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors"
                  >
                    <span>Facebook</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
                {activeStudent.insta_link && (
                  <a
                    href={activeStudent.insta_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors"
                  >
                    <span>Instagram</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {role === 'admin' && (
                <button
                  type="button"
                  disabled={deletingId === activeStudent.id}
                  onClick={(e) => handleDelete(e, activeStudent)}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}