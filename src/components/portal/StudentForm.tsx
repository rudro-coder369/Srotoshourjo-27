'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  User,
  ImagePlus,
  X,
  ArrowUpRight,
  Lock,
  Crop,
  Eye,
  ZoomIn,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { BloodGroup, Section, Student } from '@/types/student';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CROP_VIEWPORT_SIZE = 280;

interface StudentFormProps {
  currentUserId: string;
  isAdmin?: boolean;
  onSuccess: () => void;
  onGoToDirectory?: () => void;
}

export default function StudentForm({
  currentUserId,
  isAdmin = false,
  onSuccess,
  onGoToDirectory,
}: StudentFormProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [takenRollsBySection, setTakenRollsBySection] = useState<Record<string, Set<string>>>({});
  const [existingOwnProfile, setExistingOwnProfile] = useState<Student | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [fbLink, setFbLink] = useState('');
  const [instaLink, setInstaLink] = useState('');
  const [personalStory, setPersonalStory] = useState('');

  // Image & Smart Crop states
  const [rawImageSrc, setRawImageSrc] = useState<string>('');
  const [rawFileName, setRawFileName] = useState<string>('portrait.jpg');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Cropper & Full Preview Modal states
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading_image' | 'saving_db'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchInitialData() {
      const [sectionsRes, studentsRes, ownRes] = await Promise.all([
        supabase
          .from('sections')
          .select('*')
          .order('display_order', { ascending: true }),
        supabase.from('students').select('section_id, roll'),
        supabase
          .from('students')
          .select('*')
          .eq('user_id', currentUserId)
          .maybeSingle(),
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

      if (!ownRes.error && ownRes.data) {
        setExistingOwnProfile(ownRes.data as Student);
      }

      setLoadingSections(false);
    }
    fetchInitialData();
  }, [currentUserId]);

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

  // Clamp pan offset so image always covers the square crop frame
  const clampOffset = (
    nextX: number,
    nextY: number,
    targetZoom: number,
    imgW: number,
    imgH: number
  ) => {
    if (!imgW || !imgH) return { x: 0, y: 0 };
    const baseScale = Math.max(CROP_VIEWPORT_SIZE / imgW, CROP_VIEWPORT_SIZE / imgH);
    const renderedW = imgW * baseScale * targetZoom;
    const renderedH = imgH * baseScale * targetZoom;
    const maxOffsetX = Math.max(0, (renderedW - CROP_VIEWPORT_SIZE) / 2);
    const maxOffsetY = Math.max(0, (renderedH - CROP_VIEWPORT_SIZE) / 2);

    return {
      x: Math.min(maxOffsetX, Math.max(-maxOffsetX, nextX)),
      y: Math.min(maxOffsetY, Math.max(-maxOffsetY, nextY)),
    };
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

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setRawImageSrc(objectUrl);
      setRawFileName(file.name);
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPhotoFile(file);
      setPhotoPreview(objectUrl);
      setIsCropOpen(true);
    };
    img.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setOffset((prev) =>
      clampOffset(prev.x, prev.y, newZoom, naturalSize.width, naturalSize.height)
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const rawX = e.clientX - panStart.x;
    const rawY = e.clientY - panStart.y;
    setOffset(
      clampOffset(rawX, rawY, zoom, naturalSize.width, naturalSize.height)
    );
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const applyCrop = () => {
    const img = cropImgRef.current;
    if (!img || !naturalSize.width || !naturalSize.height) {
      setIsCropOpen(false);
      return;
    }

    const outputSize = 900;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseScale = Math.max(
      CROP_VIEWPORT_SIZE / naturalSize.width,
      CROP_VIEWPORT_SIZE / naturalSize.height
    );
    const totalScale = baseScale * zoom;
    const renderedW = naturalSize.width * totalScale;
    const renderedH = naturalSize.height * totalScale;

    const imgLeftInViewport = (CROP_VIEWPORT_SIZE - renderedW) / 2 + offset.x;
    const imgTopInViewport = (CROP_VIEWPORT_SIZE - renderedH) / 2 + offset.y;

    const srcX = Math.max(0, -imgLeftInViewport / totalScale);
    const srcY = Math.max(0, -imgTopInViewport / totalScale);
    const srcSize = CROP_VIEWPORT_SIZE / totalScale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      srcX,
      srcY,
      srcSize,
      srcSize,
      0,
      0,
      outputSize,
      outputSize
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cleanName = rawFileName.replace(/\.[^.]+$/, '') || 'portrait';
        const croppedFile = new File([blob], `${cleanName}-cropped.jpg`, {
          type: 'image/jpeg',
        });
        const croppedPreviewUrl = URL.createObjectURL(blob);
        setPhotoFile(croppedFile);
        setPhotoPreview(croppedPreviewUrl);
        setIsCropOpen(false);
      },
      'image/jpeg',
      0.92
    );
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setRawImageSrc('');
    setZoom(1);
    setOffset({ x: 0, y: 0 });
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
      // If admin already linked their own profile, allow adding unlinked entries; otherwise bind to currentUserId
      const ownerUserId = isAdmin && existingOwnProfile ? null : currentUserId;

      const { data, error } = await supabase
        .from('students')
        .insert([
          {
            user_id: ownerUserId,
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
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            'This account already has a published entry, or the School Roll is already taken.'
          );
        }
        throw new Error(error.message);
      }

      if (ownerUserId && data) {
        setExistingOwnProfile(data as Student);
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

  if (!loadingSections && existingOwnProfile && !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center space-y-5">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-950">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-950">
            Profile Already Published
          </h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Your entry ({existingOwnProfile.name} · Roll {existingOwnProfile.roll}) is linked to this email account. Open My Profile to view or edit it anytime.
          </p>
        </div>
        {onGoToDirectory && (
          <button
            type="button"
            onClick={onGoToDirectory}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 hover:bg-neutral-800 px-6 py-2.5 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <span>Open My Profile</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Compute rendered image dimensions inside the square crop viewport
  const baseCropScale =
    naturalSize.width && naturalSize.height
      ? Math.max(
          CROP_VIEWPORT_SIZE / naturalSize.width,
          CROP_VIEWPORT_SIZE / naturalSize.height
        )
      : 1;
  const cropImgWidth = naturalSize.width * baseCropScale * zoom;
  const cropImgHeight = naturalSize.height * baseCropScale * zoom;

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
              {isAdmin && existingOwnProfile ? 'Add Student Entry' : 'New Entry'}
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
            {/* Smart Portrait Uploader with Crop & Preview */}
            <div>
              {!photoPreview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center justify-between rounded-2xl border border-dashed p-5 transition-colors cursor-pointer ${
                    isDraggingFile
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
                        Drop or select · Built-in crop &amp; preview
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-950">
                    Upload
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setIsFullPreviewOpen(true)}
                      title="Full Preview"
                      className="group relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border border-neutral-200 cursor-pointer"
                    >
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                        <Eye className="h-4 w-4" />
                      </span>
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-950 truncate max-w-44 sm:max-w-56">
                        {photoFile?.name}
                      </p>
                      <p className="text-xs font-mono text-neutral-400">
                        {photoFile ? `${(photoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsCropOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
                    >
                      <Crop className="h-3 w-3" />
                      <span>Crop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullPreviewOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 hover:border-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-neutral-200 hover:border-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      title="Remove"
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
              Live Card Preview
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
                <button
                  type="button"
                  onClick={() => setIsFullPreviewOpen(true)}
                  className="h-20 w-20 shrink-0 rounded-2xl overflow-hidden border border-neutral-200 cursor-pointer"
                >
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </button>
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

      {/* Apple-Style Interactive Square Cropper Modal */}
      {isCropOpen && rawImageSrc && (
        <div
          onClick={() => setIsCropOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-neutral-950">
                  Adjust Portrait
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Drag to reposition · Zoom to frame
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCropOpen(false)}
                className="rounded-full border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Interactive 1:1 Crop Frame */}
            <div className="flex justify-center">
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ width: CROP_VIEWPORT_SIZE, height: CROP_VIEWPORT_SIZE }}
                className="relative overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-100 touch-none select-none cursor-grab active:cursor-grabbing"
              >
                <img
                  ref={cropImgRef}
                  src={rawImageSrc}
                  alt="Crop target"
                  draggable={false}
                  style={{
                    width: cropImgWidth,
                    height: cropImgHeight,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                  }}
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none"
                />

                {/* Subtle Rule-of-Thirds Hairline Grid */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-b border-white/35" />
                  <div className="border-r border-white/35" />
                  <div className="border-r border-white/35" />
                  <div />
                </div>
              </div>
            </div>

            {/* Zoom & Reset Controls */}
            <div className="flex items-center gap-3 px-1">
              <ZoomIn className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full accent-neutral-950 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                title="Reset"
                className="rounded-full border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsCropOpen(false)}
                className="rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-2 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                className="rounded-full bg-neutral-950 hover:bg-neutral-800 px-5 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Portrait Preview Modal */}
      {isFullPreviewOpen && photoPreview && (
        <div
          onClick={() => setIsFullPreviewOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-neutral-400">
                Portrait Preview
              </span>
              <button
                type="button"
                onClick={() => setIsFullPreviewOpen(false)}
                className="rounded-full border border-neutral-200 p-1.5 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
              <img
                src={photoPreview}
                alt="Full portrait preview"
                className="w-full aspect-square object-cover"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsFullPreviewOpen(false);
                  setIsCropOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 hover:border-neutral-950 px-4 py-1.5 text-xs font-medium text-neutral-950 transition-colors cursor-pointer"
              >
                <Crop className="h-3.5 w-3.5" />
                <span>Re-crop</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullPreviewOpen(false)}
                className="rounded-full bg-neutral-950 px-5 py-1.5 text-xs font-medium text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}