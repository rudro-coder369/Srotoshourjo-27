export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface Section {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at?: string;
}

export interface Student {
  id: string;
  user_id?: string | null;
  name: string;
  roll: string;
  section_id: string | null;
  section_name: string;
  blood_group: BloodGroup | null;
  whatsapp_number: string | null;
  fb_link: string | null;
  insta_link: string | null;
  photo_url: string;
  cloudinary_public_id?: string | null;
  personal_story: string | null;
  is_approved?: boolean;
  created_at: string;
}