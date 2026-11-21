'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  User,
  ImagePlus,
  X,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { BloodGroup, Section } from '@/types/student';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface StudentFormProps {
  onSuccess: () => void;
}

export default function StudentForm({ onSuccess }: StudentFormProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [takenRollsBySection, setTakenRollsBySection] = useState<Record<string, Set<string>>>({});

  // Form states
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [fbLink, setFbLink] = useState('');
  const [instaLink, setInstaLink] = useState('');
  const [personalStory, setPersonalStory] = useState('');

  // Image states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading_image' | 'saving_db'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchInitialData() {
      const [sectionsRes, studentsRes] = await Promise.all([
        supabase
          .from('sections')
          .select('*')
          .order('display_order', { ascending: true }),
        supabase.from('students').select('section_id, roll'),
      ]);

      if (!sectionsRes.error && sectionsRes.data && sectionsRes.data.length > 0) {
        setSections(sectionsRes.data);
        setSelectedSectionId(sectionsRes.data[0].id);
      }

      if (!studentsRes.error && studentsRes.data) {
        const map: Record<string, Set<string>> = {};
        studentsRes.data.forEach((row: { section_id: string | null; roll: string }) => {
          if (row.section_id && row.roll) {
            if (!map[row.section_id]) map[row.section_id] = new Set();
            const normalized = String(parseInt(row.roll.trim(), 10) || row.roll.trim());
            map[row.section_id].add(normalized);
          }
        });
        setTakenRollsBySection(map);
      }

      setLoadingSections(false);
    }
    fetchInitialData();
  }, []);

  // Strict roll sanitizer: digits only, no leading zeros (1, 2, 3, ..., 10, ...)
  const handleRollChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (!digitsOnly) {
      setRoll('');
      return;
    }
    const numeric = parseInt(digitsOnly, 10);
    setRoll(numeric > 0 ? String(numeric) : '');
  };

  const processFile = (file?: File) => {
    setErrorMsg('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image (JPG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image must be under 10MB.');
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const normalizeSocialUrl = (input: string, platform: 'facebook.com' | 'instagram.com') => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('@')) {
      return `https://${platform}/${trimmed.slice(1)}`;
    }
    if (!trimmed.includes('.')) {
      return `https://${platform}/${trimmed}`;
    }
    return `https://${trimmed}`;
  };

  const chosenSection = sections.find((s) => s.id === selectedSectionId);
  const isPortalLocked = !loadingSections && sections.length === 0;
  const isDuplicateRoll =
    Boolean(selectedSectionId && roll) &&
    Boolean(takenRollsBySection[selectedSectionId]?.has(roll));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isPortalLocked || !chosenSection) {
      setErrorMsg('Sections are not configured yet.');
      return;
    }

    if (!roll || parseInt(roll, 10) < 1) {
      setErrorMsg('School roll must start from 1.');
      return;
    }

    if (isDuplicateRoll) {
      setErrorMsg(`School Roll ${roll} is already registered in ${chosenSection.name}.`);
      return;
    }

    if (!photoFile) {
      setErrorMsg('Portrait photo is required.');
      return;
    }

    setSubmitting(true);

    try {
      setUploadStep('uploading_image');
      const { secure_url, public_id } = await uploadImageToCloudinary(photoFile);

      setUploadStep('saving_db');
      const { error } = await supabase.from('students').insert([
        {
          name: name.trim(),
          roll,
          section_id: chosenSection.id,
          section_name: chosenSection.name,
          blood_group: bloodGroup || null,
          whatsapp_number: whatsappNumber.trim() || null,
          fb_link: normalizeSocialUrl(fbLink, 'facebook.com'),
          insta_link: normalizeSocialUrl(instaLink, 'instagram.com'),
          photo_url: secure_url,
          cloudinary_public_id: public_id,
          personal_story: personalStory.trim() || null,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `School Roll ${roll} is already registered in ${chosenSection.name}.`
          );
        }
        throw new Error(error.message);
      }

      setTakenRollsBySection((prev) => {
        const updated = new Set(prev[chosenSection.id] || []);
        updated.add(roll);
        return { ...prev, [chosenSection.id]: updated };
      });

      setName('');
      setRoll('');
      setBloodGroup('');
      setWhatsappNumber('');
      setFbLink('');
      setInstaLink('');
      setPersonalStory('');
      clearPhoto();
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
      setUploadStep('idle');
    }
  };

  return (
    <div className="mx-auto max-w-5xl text-neutral-950">
      {isPortalLocked && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-xs text-neutral-600">
          <Lock className="h-4 w-4 shrink-0 text-neutral-950" />
          <span>Submissions locked until sections are added by Admin.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Apple / Notion Hairline Form Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-baseline justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
              New Entry
            </h2>
            <span className="text-xs font-mono text-neutral-400">
              * Required
            </span>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-neutral-950 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-950">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Portrait Dropzone */}
            <div>
              {!photoPreview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-between rounded-2xl border border-dashed p-5 transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-neutral-950 bg-neutral-100'
                      : 'border-neutral-300 hover:border-neutral-950 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-950">
                      <ImagePlus className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-950">
                        Portrait Photo *
                      </p>
                      <p className="text-xs text-neutral-400">
                        JPG, PNG, WebP · Auto-cropped
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-950">
                    Upload
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-14 w-14 shrink-0 rounded-xl object-cover border border-neutral-200"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-950 truncate">
                        {photoFile?.name}
                      </p>
                      <p className="text-xs font-mono text-neutral-400">
                        {photoFile ? `${(photoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-neutral-200 hover:border-neutral-950 px-3 py-1 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="rounded-full p-1.5 text-neutral-400 hover:text-neutral-950 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Primary Identity Grid (Notion Hairline Cells) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-neutral-200 rounded-2xl overflow-hidden bg-white">
              {/* Full Name */}
              <div className="sm:col-span-2 border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-transparent text-sm font-medium text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>

              {/* Section */}
              <div className="border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Section *
                </label>
                <select
                  required
                  disabled={loadingSections || isPortalLocked}
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-neutral-950 focus:outline-none disabled:opacity-40 cursor-pointer"
                >
                  {loadingSections ? (
                    <option value="">Loading...</option>
                  ) : sections.length === 0 ? (
                    <option value="">Unavailable</option>
                  ) : (
                    sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* School Roll */}
              <div
                className={`border-r border-b border-neutral-200 p-4 transition-colors ${
                  isDuplicateRoll ? 'bg-neutral-100' : 'focus-within:bg-neutral-50/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    School Roll *
                  </label>
                  {isDuplicateRoll ? (
                    <span className="text-[10px] font-mono font-semibold text-neutral-950">
                      Taken
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-neutral-300">
                      1, 2, 3...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[1-9][0-9]*"
                  required
                  value={roll}
                  onChange={(e) => handleRollChange(e.target.value)}
                  placeholder="1"
                  className="w-full bg-transparent font-mono text-sm font-medium text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>

              {/* Blood Group Segmented Grid */}
              <div className="sm:col-span-2 border-r border-b border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Blood Group
                  </label>
                  {bloodGroup && (
                    <button
                      type="button"
                      onClick={() => setBloodGroup('')}
                      className="text-[11px] text-neutral-400 hover:text-neutral-950 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {BLOOD_GROUPS.map((bg) => {
                    const active = bloodGroup === bg;
                    return (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBloodGroup(active ? '' : bg)}
                        className={`rounded-lg py-2 font-mono text-xs font-medium transition-all cursor-pointer ${
                          active
                            ? 'bg-neutral-950 text-white'
                            : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-950'
                        }`}
                      >
                        {bg}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact & Socials */}
              <div className="border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full bg-transparent font-mono text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>

              <div className="border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Facebook ID Link
                </label>
                <input
                  type="text"
                  value={fbLink}
                  onChange={(e) => setFbLink(e.target.value)}
                  placeholder="https://facebook.com/username"
                  className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Instagram ID Link
                </label>
                <input
                  type="text"
                  value={instaLink}
                  onChange={(e) => setInstaLink(e.target.value)}
                  placeholder="https://instagram.com/username"
                  className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
                />
              </div>

              {/* Yearbook Note */}
              <div className="sm:col-span-2 border-r border-b border-neutral-200 p-4 focus-within:bg-neutral-50/70 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    Yearbook Note
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {personalStory.length}/1500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={1500}
                  value={personalStory}
                  onChange={(e) => setPersonalStory(e.target.value)}
                  placeholder="Write a short memory or quote..."
                  className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || isPortalLocked || isDuplicateRoll}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-950 hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed py-3.5 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {uploadStep === 'uploading_image' ? 'Uploading...' : 'Saving...'}
                  </span>
                </>
              ) : (
                <>
                  <span>Publish Entry</span>
                  <ArrowUpRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Minimal Apple-Style Live Card Preview (5 cols) */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Preview
            </span>
            {roll && (
              <span className="text-[11px] font-mono text-neutral-400">
                #{roll}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-4">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="h-20 w-20 shrink-0 rounded-2xl object-cover border border-neutral-200"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-300">
                  <User className="h-7 w-7" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-neutral-500">
                    {chosenSection?.name || 'Section'}
                  </span>
                  <span className="text-neutral-300">·</span>
                  <span className="font-mono text-xs text-neutral-950">
                    Roll {roll || '—'}
                  </span>
                  {bloodGroup && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span className="rounded-md bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                        {bloodGroup}
                      </span>
                    </>
                  )}
                </div>

                <h3 className="mt-1 text-lg font-semibold tracking-tight text-neutral-950 truncate">
                  {name.trim() || 'Student Name'}
                </h3>

                {whatsappNumber.trim() && (
                  <p className="mt-0.5 font-mono text-xs text-neutral-400">
                    {whatsappNumber.trim()}
                  </p>
                )}
              </div>
            </div>

            {personalStory.trim() && (
              <p className="border-t border-neutral-100 pt-4 text-xs text-neutral-600 leading-relaxed whitespace-pre-line">
                &ldquo;{personalStory.trim()}&rdquo;
              </p>
            )}

            <div className="border-t border-neutral-100 pt-3.5 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Srotoshourjo &apos;27</span>
              <div className="flex items-center gap-3 font-medium text-neutral-950">
                {fbLink.trim() && <span>Facebook</span>}
                {instaLink.trim() && <span>Instagram</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}