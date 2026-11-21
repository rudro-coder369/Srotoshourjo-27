export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export async function uploadImageToCloudinary(
  file: File
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuration missing in .env.local');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'srotoshourjo-27');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Image upload failed');
  }

  const data = await response.json();
  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
  };
}

/**
 * প্রোফাইল কার্ডে সবার মুখ মাঝখানে রেখে দ্রুত লোড হওয়ার জন্য অপ্টিমাইজড URL তৈরি করে
 */
export function getOptimizedPhotoUrl(url: string, width = 500): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  return url.replace(
    '/upload/',
    `/upload/c_fill,g_face,w_${width},h_${width},q_auto,f_auto/`
  );
}