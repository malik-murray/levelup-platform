// Types for Resume Generator App

export type JobType = 'private_sector' | 'federal_government' | 'internship' | 'apprenticeship';
export type Tone = 'professional' | 'federal' | 'private' | 'internship' | 'friendly' | 'confident' | 'executive';

export interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
  salary?: string;
}

export interface Education {
  degree: string;
  institution: string;
  location?: string;
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface Project {
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  date?: string;
}

export interface Language {
  name: string;
  proficiency: string; // e.g., "Native", "Fluent", "Conversational", "Basic"
}

export interface Award {
  title: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface Service {
  organization: string;
  role: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface UserProfileDefaults {
  id?: string;
  user_id: string;
  full_name?: string;
  phone?: string;
  email?: string;
  location?: string;
  summary?: string;
  skills: string[] | { name: string; category?: string }[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  languages: Language[];
  awards: Award[];
  service: Service[];
  updated_at?: string;
  created_at?: string;
}

export interface Template {
  id: string;
  type: 'resume' | 'cover_letter';
  name: string;
  description?: string;
  layout_config: {
    sections?: string[];
    font?: string;
    fontSize?: number;
    paragraphSpacing?: number;
    [key: string]: any;
  };
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  default_tone: Tone;
  default_job_type: JobType;
  default_resume_template_id?: string;
  default_cover_letter_template_id?: string;
  default_header_footer_options: Record<string, any>;
  default_visibility_preferences: {
    show_salary?: boolean;
    show_awards?: boolean;
    show_service?: boolean;
    show_languages?: boolean;
    show_certifications?: boolean;
    show_projects?: boolean;
    [key: string]: any;
  };
  updated_at?: string;
  created_at?: string;
}

export interface Credits {
  id?: string;
  user_id: string;
  total_credits: number;
  used_credits: number;
  created_at?: string;
  updated_at?: string;
}

export interface Generation {
  id?: string;
  user_id: string;
  job_title: string;
  company_name?: string;
  job_type?: JobType;
  resume_template_id?: string;
  cover_letter_template_id?: string;
  tone?: Tone;
  options: {
    show_salary?: boolean;
    show_awards?: boolean;
    show_service?: boolean;
    show_languages?: boolean;
    show_certifications?: boolean;
    show_projects?: boolean;
    former_salary?: string;
    desired_salary?: string;
    experience_emphasis?: number; // 0-100
    skills_emphasis?: number; // 0-100
    length?: '1-page' | '2-page';
    [key: string]: any;
  };
  job_description: string;
  generated_resume_markdown?: string;
  generated_cover_letter_markdown?: string;
  resume_docx_url?: string;
  cover_letter_docx_url?: string;
  tokens_used?: number;
  created_at?: string;
}

export interface GeneratedResumeContent {
  profile?: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    bullets: string[];
  }>;
  skills: string[];
  education: Array<{
    degree: string;
    institution: string;
    location?: string;
    graduationDate?: string;
    gpa?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
  }>;
  awards?: Array<{
    title: string;
    issuer?: string;
    date?: string;
  }>;
  service?: Array<{
    organization: string;
    role: string;
    dates: string;
    description?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies?: string[];
  }>;
  salary_section?: string;
  custom_sections?: Array<{
    header: string;
    content: string;
  }>;
  role_alignment?: {
    summary_of_duties_header?: string;
    summary_of_duties?: string[];
    essential_functions_header?: string;
    essential_functions?: string[];
    minimum_qualifications_header?: string;
    minimum_qualifications?: string[];
  };
}

export interface GeneratedCoverLetterContent {
  subject?: string;
  greeting: string;
  opening: string;
  body: string[];
  closing: string;
  signature: string;
}

export interface JobDescriptionSection {
  header: string;
  content: string;
}

export interface ParsedJobDescription {
  sections: JobDescriptionSection[];
  detectedHeaders: string[];
}

export interface GenerationRequest {
  job_title: string;
  company_name?: string;
  job_type: JobType;
  tone: Tone;
  job_description: string;
  parsed_job_description?: ParsedJobDescription;
  resume_template_id?: string;
  cover_letter_template_id?: string;
  options: Generation['options'];
}



