export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface Section {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

export interface Student {
  id: string;
  name: string;
  roll: string;
  section_id?: string | null;
  section_name: string;
  fb_link?: string | null;
  insta_link?: string | null;
  whatsapp_number?: string | null;
  blood_group?: BloodGroup | null;
  photo_url: string;
  cloudinary_public_id?: string | null;
  personal_story?: string | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentFormInput {
  name: string;
  roll: string;
  section_id: string;
  section_name: string;
  fb_link: string;
  insta_link: string;
  whatsapp_number: string;
  blood_group: BloodGroup | '';
  photo_url: string;
  cloudinary_public_id: string;
  personal_story: string;
}