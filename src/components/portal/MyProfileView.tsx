'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Loader2,
  Pencil,
  ImagePlus,
  X,
  ArrowUpRight,
  Plus,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOptimizedPhotoUrl, uploadImageToCloudinary } from '@/lib/cloudinary';
import { Student, Section, BloodGroup } from '@/types/student';
import { UserRole } from './AuthGate';

interface MyProfileViewProps {
  currentUserId: string;
  email: string;
  role: UserRole;
  refreshTrigger: number;
  onProfileUpdated: () => void;
  onGoToCreate: () => void;
}

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MyProfileView({
  currentUserId,
  email,
  role,
  refreshTrigger,
  onProfileUpdated,
  onGoToCreate,
}: MyProfileViewProps) {
  const [profile, setProfile] = useState<Student | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [allRolls, setAllRolls] = useState<{ id: string; section_id: string | null; roll: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRoll, setEditRoll] = useState('');
  const [editSectionId, setEditSectionId] = useState('');
  const [editBloodGroup, setEditBloodGroup] = useState<BloodGroup | ''>('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editFbLink, setEditFbLink] = useState('');
  const [editInstaLink, setEditInstaLink] = useState('');
  const [editStory, setEditStory] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMyProfile = async () => {
    setLoading(true);
    const [profileRes, sectionsRes, rollsRes] = await Promise.all([
      supabase
        .from('students')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle(),
      supabase
        .from('sections')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase.from('students').select('id, section_id, roll'),
    ]);

    if (!sectionsRes.error && sectionsRes.data) {
      setSections(sectionsRes.data as Section[]);
    }
    if (!rollsRes.error && rollsRes.data) {
      setAllRolls(rollsRes.data);
    }
    if (!profileRes.error) {
      setProfile((profileRes.data as Student) || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMyProfile();
  }, [currentUserId, refreshTrigger]);

  const startEditing = () => {
    if (!profile) return;
    setErrorMsg('');
    setEditName(profile.name);
    setEditRoll(String(parseInt(profile.roll.trim(), 10) || profile.roll.trim()));
    const matchedSection =
      sections.find((s) => s.id === profile.section_id) ||
      sections.find((s) => s.name === profile.section_name);
    setEditSectionId(matchedSection?.id || profile.section_id || '');
    setEditBloodGroup((profile.blood_group as BloodGroup) || '');
    setEditWhatsapp(profile.whatsapp_number || '');
    setEditFbLink(profile.fb_link || '');
    setEditInstaLink(profile.insta_link || '');
    setEditStory(profile.personal_story || '');
    setEditPhotoFile(null);
    setEditPhotoPreview(getOptimizedPhotoUrl(profile.photo_url, 500));
    setIsEditing(true);
  };

  const handleRollChange = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (!digitsOnly) {
      setEditRoll('');
      return;
    }
    const numeric = parseInt(digitsOnly, 10);
    setEditRoll(numeric > 0 ? String(numeric) : '');
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image must be under 10MB.');
      return;
    }
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
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

  const isDuplicateRoll = useMemo(() => {
    if (!profile || !editSectionId || !editRoll) return false;
    return allRolls.some((row) => {
      if (row.id === profile.id) return false;
      const sameSection = row.section_id === editSectionId;
      const normalized = String(parseInt(row.roll.trim(), 10) || row.roll.trim());
      return sameSection && normalized === editRoll;
    });
  }, [profile, editSectionId, editRoll, allRolls]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setErrorMsg('');

    const chosenSection = sections.find((s) => s.id === editSectionId);
    if (!chosenSection) {
      setErrorMsg('Please select a valid section.');
      return;
    }

    if (!editRoll || parseInt(editRoll, 10) < 1) {
      setErrorMsg('School roll must start from 1.');
      return;
    }

    if (isDuplicateRoll) {
      setErrorMsg(`School Roll ${editRoll} is already taken in ${chosenSection.name}.`);
      return;
    }

    setSaving(true);

    try {
      let photoUrl = profile.photo_url;
      let publicId = profile.cloudinary_public_id;

      if (editPhotoFile) {
        const uploaded = await uploadImageToCloudinary(editPhotoFile);
        photoUrl = uploaded.secure_url;
        publicId = uploaded.public_id;
      }

      const updatedFields = {
        name: editName.trim(),
        roll: editRoll,
        section_id: chosenSection.id,
        section_name: chosenSection.name,
        blood_group: editBloodGroup || null,
        whatsapp_number: editWhatsapp.trim() || null,
        fb_link: normalizeSocialUrl(editFbLink, 'facebook.com'),
        insta_link: normalizeSocialUrl(editInstaLink, 'instagram.com'),
        photo_url: photoUrl,
        cloudinary_public_id: publicId,
        personal_story: editStory.trim() || null,
      };

      const { data, error } = await supabase
        .from('students')
        .update(updatedFields)
        .eq('id', profile.id)
        .eq('user_id', currentUserId)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`School Roll ${editRoll} is already taken in ${chosenSection.name}.`);
        }
        throw new Error(error.message);
      }

      setProfile((data as Student) || { ...profile, ...updatedFields });
      setIsEditing(false);
      setEditPhotoFile(null);
      onProfileUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-20 flex justify-center text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 text-neutral-950">
      {/* Account Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
            My Profile
          </h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
            <Mail className="h-3.5 w-3.5 text-neutral-400" />
            <span className="font-mono">{email}</span>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1 font-mono uppercase text-[10px] text-neutral-600">
              {role === 'admin' && <ShieldCheck className="h-3 w-3" />}
              {role}
            </span>
          </div>
        </div>

        {profile && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 px-4 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* Empty State if User Hasn't Created Profile Yet */}
      {!profile ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-400">
            <UserIcon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-neutral-950">
              No Profile Published Yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
              You haven&apos;t created your yearbook entry with this account yet. Publish your profile to appear in the batch directory.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 px-5 py-2.5 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create My Entry</span>
          </button>
        </div>
      ) : !isEditing ? (
        /* Published Profile Card View */
        <div className="rounded-3xl border border-neutral-200 bg-white p-7 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <img
              src={getOptimizedPhotoUrl(profile.photo_url, 500)}
              alt={profile.name}
              className="h-24 w-24 shrink-0 rounded-2xl object-cover border border-neutral-200"
            />

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">{profile.section_name}</span>
                <span className="text-neutral-300">·</span>
                <span className="font-mono font-medium text-neutral-950">
                  Roll {profile.roll}
                </span>
                {profile.blood_group && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span className="rounded bg-neutral-950 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white">
                      {profile.blood_group}
                    </span>
                  </>
                )}
              </div>

              <h3 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {profile.name}
              </h3>

              {profile.whatsapp_number && (
                <p className="font-mono text-xs text-neutral-500">
                  WhatsApp: {profile.whatsapp_number}
                </p>
              )}
            </div>
          </div>

          {profile.personal_story && (
            <div className="border-t border-neutral-100 pt-5">
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-2">
                Yearbook Note
              </p>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                &ldquo;{profile.personal_story}&rdquo;
              </p>
            </div>
          )}

          <div className="border-t border-neutral-100 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {profile.fb_link && (
                <a
                  href={profile.fb_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors"
                >
                  <span>Facebook</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              {profile.insta_link && (
                <a
                  href={profile.insta_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors"
                >
                  <span>Instagram</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <span className="font-mono text-[11px] text-neutral-400">
              Published · Srotoshourjo &apos;27
            </span>
          </div>
        </div>
      ) : (
        /* Inline Edit Form */
        <form
          onSubmit={handleSave}
          className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <h3 className="text-lg font-semibold tracking-tight text-neutral-950">
              Edit My Profile
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-neutral-950 bg-neutral-50 px-3.5 py-2.5 text-xs font-medium text-neutral-950">
              {errorMsg}
            </div>
          )}

          {/* Portrait Change */}
          <div className="flex items-center justify-between rounded-2xl border border-neutral-200 p-3.5">
            <div className="flex items-center gap-3.5">
              <img
                src={editPhotoPreview}
                alt={editName}
                className="h-14 w-14 rounded-xl object-cover border border-neutral-200"
              />
              <div>
                <p className="text-xs font-medium text-neutral-950">Portrait Photo</p>
                <p className="text-[11px] text-neutral-400">
                  {editPhotoFile ? editPhotoFile.name : 'Current portrait'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 hover:border-neutral-950 px-3.5 py-1.5 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Change</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* Hairline Input Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-neutral-200 rounded-2xl overflow-hidden bg-white">
            <div className="sm:col-span-2 border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-neutral-950 focus:outline-none"
              />
            </div>

            <div className="border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Section *
              </label>
              <select
                required
                value={editSectionId}
                onChange={(e) => setEditSectionId(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-neutral-950 focus:outline-none cursor-pointer"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`border-r border-b border-neutral-200 p-3.5 ${
                isDuplicateRoll ? 'bg-neutral-100' : 'focus-within:bg-neutral-50/70'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  School Roll *
                </label>
                {isDuplicateRoll && (
                  <span className="text-[10px] font-mono font-semibold text-neutral-950">
                    Taken
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]*"
                required
                value={editRoll}
                onChange={(e) => handleRollChange(e.target.value)}
                className="w-full bg-transparent font-mono text-sm font-medium text-neutral-950 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 border-r border-b border-neutral-200 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Blood Group
                </label>
                {editBloodGroup && (
                  <button
                    type="button"
                    onClick={() => setEditBloodGroup('')}
                    className="text-[11px] text-neutral-400 hover:text-neutral-950 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {BLOOD_GROUPS.map((bg) => {
                  const active = editBloodGroup === bg;
                  return (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => setEditBloodGroup(active ? '' : bg)}
                      className={`rounded-lg py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-neutral-950 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:text-neutral-950'
                      }`}
                    >
                      {bg}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                WhatsApp
              </label>
              <input
                type="tel"
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full bg-transparent font-mono text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
              />
            </div>

            <div className="border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Facebook ID Link
              </label>
              <input
                type="text"
                value={editFbLink}
                onChange={(e) => setEditFbLink(e.target.value)}
                placeholder="https://facebook.com/username"
                className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Instagram ID Link
              </label>
              <input
                type="text"
                value={editInstaLink}
                onChange={(e) => setEditInstaLink(e.target.value)}
                placeholder="https://instagram.com/username"
                className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 border-r border-b border-neutral-200 p-3.5 focus-within:bg-neutral-50/70">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Yearbook Note
                </label>
                <span className="text-[10px] font-mono text-neutral-400">
                  {editStory.length}/1500
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={1500}
                value={editStory}
                onChange={(e) => setEditStory(e.target.value)}
                placeholder="Write a short memory or quote..."
                className="w-full bg-transparent text-sm text-neutral-950 placeholder:text-neutral-300 focus:outline-none leading-relaxed resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-full border border-neutral-200 hover:border-neutral-950 px-5 py-2 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isDuplicateRoll}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 disabled:opacity-35 px-6 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}