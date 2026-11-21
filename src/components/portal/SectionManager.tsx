'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Section } from '@/types/student';

interface SectionManagerProps {
  onSectionsChange: () => void;
}

const QUICK_PRESETS = [
  'Science - A',
  'Science - B',
  'Science - C',
  'Business Studies',
  'Humanities',
];

export default function SectionManager({ onSectionsChange }: SectionManagerProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [newSectionName, setNewSectionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [sectionsRes, studentsRes] = await Promise.all([
      supabase
        .from('sections')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase.from('students').select('section_id'),
    ]);

    if (!sectionsRes.error && sectionsRes.data) {
      setSections(sectionsRes.data as Section[]);
    }

    if (!studentsRes.error && studentsRes.data) {
      const counts: Record<string, number> = {};
      studentsRes.data.forEach((row: { section_id: string | null }) => {
        if (row.section_id) {
          counts[row.section_id] = (counts[row.section_id] || 0) + 1;
        }
      });
      setStudentCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createSlug = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const addSectionByName = async (rawName: string) => {
    setErrorMsg('');
    const trimmed = rawName.trim();
    if (!trimmed) return;

    const slug = createSlug(trimmed) || `section-${Date.now()}`;
    const nextOrder =
      sections.length > 0
        ? Math.max(...sections.map((s) => s.display_order)) + 1
        : 1;

    setAdding(true);
    const { data, error } = await supabase
      .from('sections')
      .insert([{ name: trimmed, slug, display_order: nextOrder }])
      .select()
      .single();

    if (error) {
      setErrorMsg(
        error.code === '23505' ? `"${trimmed}" already exists.` : error.message
      );
    } else if (data) {
      setSections((prev) => [...prev, data as Section]);
      setNewSectionName('');
      onSectionsChange();
    }
    setAdding(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSectionByName(newSectionName);
  };

  const handleRenameSave = async (sec: Section) => {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === sec.name) {
      setEditingId(null);
      return;
    }

    setBusyId(sec.id);
    setErrorMsg('');
    const newSlug = createSlug(trimmed) || sec.slug;

    const { error } = await supabase
      .from('sections')
      .update({ name: trimmed, slug: newSlug })
      .eq('id', sec.id);

    if (error) {
      setErrorMsg(
        error.code === '23505' ? `"${trimmed}" already exists.` : error.message
      );
    } else {
      await supabase
        .from('students')
        .update({ section_name: trimmed })
        .eq('section_id', sec.id);

      setSections((prev) =>
        prev.map((item) =>
          item.id === sec.id ? { ...item, name: trimmed, slug: newSlug } : item
        )
      );
      setEditingId(null);
      onSectionsChange();
    }
    setBusyId(null);
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    const reindexed = updated.map((item, idx) => ({
      ...item,
      display_order: idx + 1,
    }));

    setSections(reindexed);

    await Promise.all(
      reindexed.map((item) =>
        supabase
          .from('sections')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      )
    );
    onSectionsChange();
  };

  const handleDeleteSection = async (sec: Section) => {
    setErrorMsg('');
    const enrolledCount = studentCounts[sec.id] || 0;
    if (enrolledCount > 0) {
      setErrorMsg(
        `Cannot remove "${sec.name}" (${enrolledCount} active entries).`
      );
      return;
    }

    if (!window.confirm(`Remove "${sec.name}"?`)) return;

    setBusyId(sec.id);
    const { error } = await supabase.from('sections').delete().eq('id', sec.id);

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSections((prev) => prev.filter((item) => item.id !== sec.id));
      onSectionsChange();
    }
    setBusyId(null);
  };

  const availablePresets = QUICK_PRESETS.filter(
    (preset) =>
      !sections.some((s) => s.name.toLowerCase() === preset.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl space-y-10 text-neutral-950">
      {/* Minimal Header & Input */}
      <div className="space-y-6">
        <div className="flex items-baseline justify-between border-b border-neutral-200 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Sections
          </h2>
          <span className="text-xs font-mono text-neutral-400">
            {sections.length} total
          </span>
        </div>

        {errorMsg && (
          <p className="rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-950">
            {errorMsg}
          </p>
        )}

        {/* Clean Pill Input + Black CTA */}
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            required
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="New section name..."
            className="flex-1 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={adding || !newSectionName.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 disabled:opacity-35 px-6 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>Add</span>
          </button>
        </form>

        {/* Minimal Preset Chips */}
        {availablePresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {availablePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={adding}
                onClick={() => addSectionByName(preset)}
                className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white hover:border-neutral-950 px-3 py-1 text-xs text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>{preset}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notion / Apple Style Hairline Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 py-16 text-center">
          <p className="text-sm text-neutral-400">No sections configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-neutral-200 rounded-2xl overflow-hidden">
          {sections.map((sec, idx) => {
            const count = studentCounts[sec.id] || 0;
            const isEditing = editingId === sec.id;
            const isBusy = busyId === sec.id;

            return (
              <div
                key={sec.id}
                className="group relative flex flex-col justify-between border-r border-b border-neutral-200 bg-white hover:bg-neutral-50/70 p-5 transition-colors min-h-31"
              >
                {/* Top Row: Index + Hover Actions */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-neutral-400">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleReorder(idx, 'up')}
                      title="Move earlier"
                      className="rounded-md p-1 text-neutral-400 hover:text-neutral-950 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => handleReorder(idx, 'down')}
                      title="Move later"
                      className="rounded-md p-1 text-neutral-400 hover:text-neutral-950 disabled:opacity-20 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(sec.id);
                          setEditingName(sec.name);
                        }}
                        title="Rename"
                        className="rounded-md p-1 text-neutral-400 hover:text-neutral-950 cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDeleteSection(sec)}
                      title={count > 0 ? 'Locked (has entries)' : 'Remove'}
                      className={`rounded-md p-1 cursor-pointer ${
                        count > 0
                          ? 'text-neutral-300'
                          : 'text-neutral-400 hover:text-neutral-950'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : count > 0 ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Section Title + Student Count */}
                <div className="mt-5">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSave(sec);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full rounded-lg border border-neutral-950 bg-white px-2.5 py-1 text-sm font-medium text-neutral-950 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleRenameSave(sec)}
                        className="rounded-lg bg-neutral-950 p-1.5 text-white cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 hover:text-neutral-950 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-medium tracking-tight text-neutral-950 truncate">
                        {sec.name}
                      </h3>
                      <span className="shrink-0 font-mono text-xs text-neutral-400">
                        {count}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}