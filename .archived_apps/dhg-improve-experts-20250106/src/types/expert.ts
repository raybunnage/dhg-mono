// Expert types
export interface ExpertInterface {
  id: string;
  expert_name: string;
  full_name: string | null;
  is_in_core_group: boolean;
  mnemonic: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  starting_ref_id: number | null;
  // Optional new fields for enhanced profile
  enhanced_profile_id?: string;
}

// Helper functions for Expert data
export const expertUtils = {
  /**
   * Normalizes expert data from various sources
   */
  normalizeExpert(expert: Partial<ExpertInterface>): ExpertInterface {
    return {
      id: expert.id || '',
      expert_name: expert.expert_name || '',
      full_name: expert.full_name || null,
      is_in_core_group: expert.is_in_core_group ?? false,
      mnemonic: expert.mnemonic || null,
      metadata: expert.metadata || null,
      created_at: expert.created_at || new Date().toISOString(),
      updated_at: expert.updated_at || new Date().toISOString(),
      user_id: expert.user_id || null,
      starting_ref_id: expert.starting_ref_id || null,
      enhanced_profile_id: expert.enhanced_profile_id || undefined
    };
  }
}

export interface ExpertDocument {
  id: string;
  expert_id: string;
  source_id: string;
  document_type: string;
  title: string | null;
  extraction_date: string;
  raw_content: string | null;
  processed_content: any | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

export interface ExpertFormData {
  expert_name: string;
  full_name: string;
  mnemonic: string;
  is_in_core_group: boolean;
  metadata?: Record<string, any>;
}

export interface ExpertDocumentFormData {
  expert_id: string;
  source_id: string;
  document_type: string;
  title: string;
  raw_content: string;
}

// Enhanced expert profile types
export interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

export interface Experience {
  organization: string;
  role: string;
  duration: string;
  description: string;
}

export interface Publication {
  title: string;
  year: string;
  journal: string;
  authors: string[];
  url?: string;
}

export interface Award {
  title: string;
  year: string;
  organization: string;
}

export interface EnhancedExpertProfile {
  name: string;
  title?: string;
  affiliations?: string[];
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  expertise?: string[];
  education?: Education[];
  experience?: Experience[];
  publications?: Publication[];
  awards?: Award[];
  languages?: string[];
  skills?: string[];
  interests?: string[];
  bio?: string;
  research_areas?: string[];
  social_media?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    other?: Record<string, string>;
  };
}