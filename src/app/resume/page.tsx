'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import type {
  GenerationRequest,
  GeneratedResumeContent,
  GeneratedCoverLetterContent,
  Template,
  UserProfileDefaults,
  UserSettings,
  JobType,
  Tone,
} from '@/lib/resume/types';

// Helper to get user ID from client-side Supabase
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export default function GenerateResumePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<UserProfileDefaults | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [templates, setTemplates] = useState<{ resume: Template[]; coverLetter: Template[] }>({
    resume: [],
    coverLetter: [],
  });
  const [credits, setCredits] = useState<{ remaining: number; total: number; used: number }>({
    remaining: 0,
    total: 0,
    used: 0,
  });

  // Form state
  const [formData, setFormData] = useState<Partial<GenerationRequest>>({
    job_title: '',
    company_name: '',
    job_type: 'private_sector',
    tone: 'professional',
    job_description: '',
    parsed_job_description: undefined,
    resume_template_id: '',
    cover_letter_template_id: '',
    options: {
      show_salary: false,
      show_awards: false,
      show_service: false,
      show_languages: false,
      show_certifications: true,
      show_projects: false,
      former_salary: '',
      desired_salary: '',
      experience_emphasis: 50,
      skills_emphasis: 50,
      length: '1-page',
    },
  });

  const [parsingJobDescription, setParsingJobDescription] = useState(false);
  const [jobDescriptionSections, setJobDescriptionSections] = useState<Array<{ header: string; content: string }>>([]);

  async function parseJobDescription() {
    if (!formData.job_description || formData.job_description.trim().length === 0) {
      setError('Please enter a job description first');
      return;
    }

    setParsingJobDescription(true);
    setError(null);
    try {
      const response = await fetch('/api/resume/parse-job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: formData.job_description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse job description');
      }

      if (data.data) {
        setJobDescriptionSections(data.data.sections || []);
        setFormData({
          ...formData,
          parsed_job_description: data.data,
        });
        alert(`Found ${data.data.sections?.length || 0} sections in the job description!`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      setError(error instanceof Error ? error.message : 'Failed to parse job description');
    } finally {
      setParsingJobDescription(false);
    }
  }

  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    resume: GeneratedResumeContent;
    cover_letter: GeneratedCoverLetterContent;
    generation_id: string;
  } | null>(null);
  const [resumeFormattedText, setResumeFormattedText] = useState<string>('');
  const [coverLetterFormattedText, setCoverLetterFormattedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Format resume content into a single formatted text string
  function formatResumeContent(content: GeneratedResumeContent, userProfile?: UserProfileDefaults | null): string {
    let formatted = '';

    // Personal Information Header
    if (userProfile) {
      const headerParts: string[] = [];
      if (userProfile.full_name) headerParts.push(userProfile.full_name);
      if (userProfile.email) headerParts.push(userProfile.email);
      if (userProfile.phone) headerParts.push(userProfile.phone);
      if (userProfile.location) headerParts.push(userProfile.location);
      
      if (headerParts.length > 0) {
        formatted += headerParts.join(' | ') + '\n';
        formatted += '═'.repeat(80) + '\n\n';
      }
    }

    // Professional Summary
    if (content.profile) {
      formatted += 'PROFESSIONAL SUMMARY\n';
      formatted += '═'.repeat(50) + '\n';
      formatted += content.profile + '\n\n';
    }

    // Core Skills & Tools
    if (content.skills && content.skills.length > 0) {
      formatted += 'CORE SKILLS & TOOLS\n';
      formatted += '═'.repeat(50) + '\n';
      formatted += content.skills.join(', ') + '\n\n';
    }

    // Experience
    if (content.experience && content.experience.length > 0) {
      formatted += 'PROFESSIONAL EXPERIENCE\n';
      formatted += '═'.repeat(50) + '\n';
      content.experience.forEach((exp) => {
        formatted += `${exp.title}${exp.company ? ` | ${exp.company}` : ''}${exp.location ? `, ${exp.location}` : ''}\n`;
        if (exp.dates) {
          formatted += `${exp.dates}\n`;
        }
        if (exp.bullets && exp.bullets.length > 0) {
          exp.bullets.forEach((bullet) => {
            formatted += `  • ${bullet}\n`;
          });
        }
        formatted += '\n';
      });
    }

    // Education
    if (content.education && content.education.length > 0) {
      formatted += 'EDUCATION\n';
      formatted += '═'.repeat(50) + '\n';
      content.education.forEach((edu) => {
        formatted += `${edu.degree}${edu.institution ? `, ${edu.institution}` : ''}${edu.location ? `, ${edu.location}` : ''}`;
        if (edu.graduationDate) {
          formatted += ` | ${edu.graduationDate}`;
        }
        if (edu.gpa) {
          formatted += ` | GPA: ${edu.gpa}`;
        }
        formatted += '\n';
      });
      formatted += '\n';
    }

    // Certifications
    if (content.certifications && content.certifications.length > 0) {
      formatted += 'CERTIFICATIONS\n';
      formatted += '═'.repeat(50) + '\n';
      content.certifications.forEach((cert) => {
        formatted += `${cert.name}${cert.issuer ? `, ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}\n`;
      });
      formatted += '\n';
    }

    // Projects
    if (content.projects && content.projects.length > 0) {
      formatted += 'PROJECTS\n';
      formatted += '═'.repeat(50) + '\n';
      content.projects.forEach((proj) => {
        formatted += `${proj.name}: ${proj.description || ''}`;
        if (proj.technologies && proj.technologies.length > 0) {
          formatted += ` (Technologies: ${proj.technologies.join(', ')})`;
        }
        formatted += '\n';
      });
      formatted += '\n';
    }

    // Languages
    if (content.languages && content.languages.length > 0) {
      formatted += 'LANGUAGES\n';
      formatted += '═'.repeat(50) + '\n';
      formatted += content.languages.map((lang) => `${lang.name} (${lang.proficiency})`).join(', ') + '\n\n';
    }

    // Awards
    if (content.awards && content.awards.length > 0) {
      formatted += 'AWARDS & RECOGNITION\n';
      formatted += '═'.repeat(50) + '\n';
      content.awards.forEach((award) => {
        formatted += `${award.title}${award.issuer ? `, ${award.issuer}` : ''}${award.date ? ` (${award.date})` : ''}\n`;
      });
      formatted += '\n';
    }

    // Service
    if (content.service && content.service.length > 0) {
      formatted += 'SERVICE & VOLUNTEER WORK\n';
      formatted += '═'.repeat(50) + '\n';
      content.service.forEach((svc) => {
        formatted += `${svc.role} at ${svc.organization}${svc.dates ? ` | ${svc.dates}` : ''}`;
        if (svc.description) {
          formatted += `\n  ${svc.description}`;
        }
        formatted += '\n';
      });
      formatted += '\n';
    }

    // Role Alignment
    if (content.role_alignment) {
      formatted += 'ROLE ALIGNMENT\n';
      formatted += '═'.repeat(50) + '\n\n';

      if (content.role_alignment.summary_of_duties && content.role_alignment.summary_of_duties.length > 0) {
        formatted += `${content.role_alignment.summary_of_duties_header || 'SUMMARY OF DUTIES'}\n`;
        formatted += '─'.repeat(50) + '\n';
        content.role_alignment.summary_of_duties.forEach((bullet) => {
          formatted += `  • ${bullet}\n`;
        });
        formatted += '\n';
      }

      if (content.role_alignment.essential_functions && content.role_alignment.essential_functions.length > 0) {
        formatted += `${content.role_alignment.essential_functions_header || 'ESSENTIAL FUNCTIONS'}\n`;
        formatted += '─'.repeat(50) + '\n';
        content.role_alignment.essential_functions.forEach((bullet) => {
          formatted += `  • ${bullet}\n`;
        });
        formatted += '\n';
      }

      if (content.role_alignment.minimum_qualifications && content.role_alignment.minimum_qualifications.length > 0) {
        formatted += `${content.role_alignment.minimum_qualifications_header || 'MINIMUM QUALIFICATIONS'}\n`;
        formatted += '─'.repeat(50) + '\n';
        content.role_alignment.minimum_qualifications.forEach((bullet) => {
          formatted += `  • ${bullet}\n`;
        });
        formatted += '\n';
      }
    }

    // Salary Section
    if (content.salary_section) {
      formatted += 'SALARY INFORMATION\n';
      formatted += '═'.repeat(50) + '\n';
      formatted += content.salary_section + '\n\n';
    }

    return formatted.trim();
  }

  // Format cover letter content into a single formatted text string
  function formatCoverLetterContent(content: GeneratedCoverLetterContent): string {
    let formatted = '';

    if (content.subject) {
      formatted += `Subject: ${content.subject}\n\n`;
    }

    formatted += `${content.greeting}\n\n`;

    formatted += content.opening + '\n\n';

    if (content.body && content.body.length > 0) {
      content.body.forEach((paragraph) => {
        formatted += paragraph + '\n\n';
      });
    }

    formatted += content.closing + '\n\n';

    formatted += content.signature;

    return formatted.trim();
  }

  // Check authentication first
  useEffect(() => {
    checkAuth();
  }, []);

  // Load initial data after auth is confirmed
  useEffect(() => {
    if (authChecked) {
      loadInitialData();
    }
  }, [authChecked]);

  async function checkAuth() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }
      
      setAuthChecked(true);
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/login');
    }
  }

  async function loadInitialData() {
    try {
      setLoading(true);

      // Get user ID from client-side Supabase (like finance app does)
      const userId = await getCurrentUserId();
      if (!userId) {
        router.push('/login');
        return;
      }

      // Load profile directly from Supabase (like finance app does)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profile_defaults')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
        setError('Failed to load profile. Please refresh the page.');
        setLoading(false);
        return;
      }

      // If no profile exists, redirect to onboarding
      if (!profileData) {
        router.push('/resume/onboarding');
        return;
      }

      setProfile(profileData);

      // Load other data in parallel with proper error handling
      const [settingsResult, templatesResult, creditsResult] = await Promise.all([
        (async () => {
          try {
            return await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', userId)
              .single();
          } catch {
            return { data: null, error: null };
          }
        })(),
        Promise.all([
          (async () => {
            try {
              return await supabase
                .from('templates')
                .select('*')
                .eq('type', 'resume')
                .order('is_default', { ascending: false });
            } catch {
              return { data: [], error: null };
            }
          })(),
          (async () => {
            try {
              return await supabase
                .from('templates')
                .select('*')
                .eq('type', 'cover_letter')
                .order('is_default', { ascending: false });
            } catch {
              return { data: [], error: null };
            }
          })(),
        ]),
        (async () => {
          try {
            return await supabase
              .from('credits')
              .select('*')
              .eq('user_id', userId)
              .single();
          } catch {
            return { data: null, error: null };
          }
        })(),
      ]);

      const settingsData = settingsResult.data;
      const [resumeTemplatesRes, coverLetterTemplatesRes] = templatesResult;
      const creditsData = creditsResult.data;

      setSettings(settingsData || {
        default_tone: 'professional',
        default_job_type: 'private_sector',
        default_visibility_preferences: {},
      });

      const resumeTemplates = resumeTemplatesRes.data || [];
      const coverLetterTemplates = coverLetterTemplatesRes.data || [];

      setTemplates({
        resume: resumeTemplates || [],
        coverLetter: coverLetterTemplates || [],
      });

      // Set default templates from settings
      if (settingsData) {
        setFormData((prev) => ({
          ...prev,
          resume_template_id: settingsData.default_resume_template_id || '',
          cover_letter_template_id: settingsData.default_cover_letter_template_id || '',
          tone: settingsData.default_tone || 'professional',
          job_type: settingsData.default_job_type || 'private_sector',
        }));
      }

      setCredits({
        remaining: creditsData ? creditsData.total_credits - creditsData.used_credits : 0,
        total: creditsData?.total_credits || 0,
        used: creditsData?.used_credits || 0,
      });
    } catch (err) {
      console.error('Error loading initial data:', err);
      // Only redirect to login if it's an auth error
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      setError('Failed to load data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!formData.job_title || !formData.job_description) {
      setError('Please fill in job title and job description');
      return;
    }

    // Check credits (allow unlimited for testing)
    if (credits.total < 999999 && credits.remaining < 1) {
      setError('Insufficient credits. Please purchase more credits to continue.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/resume/generate-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          userId, // Pass userId from client to avoid auth issues
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate resume');
      }

      setGeneratedContent({
        resume: data.resume,
        cover_letter: data.cover_letter,
        generation_id: data.generation_id,
        resume_docx_base64: data.resume_docx_base64,
        cover_letter_docx_base64: data.cover_letter_docx_base64,
      } as any);

      // Format the content for display
      setResumeFormattedText(formatResumeContent(data.resume, profile));
      setCoverLetterFormattedText(formatCoverLetterContent(data.cover_letter));

      // Refresh credits using client-side Supabase
      const currentUserId = await getCurrentUserId();
      if (currentUserId) {
        const { data: creditsData } = await supabase
          .from('credits')
          .select('*')
          .eq('user_id', currentUserId)
          .single();
        
        if (creditsData) {
          setCredits({
            remaining: creditsData.total_credits - creditsData.used_credits,
            total: creditsData.total_credits,
            used: creditsData.used_credits,
          });
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate resume');
    } finally {
      setGenerating(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      // Step 1: Parse file to text
      const formData = new FormData();
      formData.append('file', file);

      const parseResponse = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
      });

      const parseData = await parseResponse.json();

      if (!parseResponse.ok) {
        throw new Error(parseData.error || 'Failed to parse resume');
      }

      // Step 2: Use AI to extract structured data
      setParsing(true);
      const structuredResponse = await fetch('/api/resume/parse-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: parseData.resumeText }),
      });

      const structuredData = await structuredResponse.json();

      if (!structuredResponse.ok) {
        throw new Error(structuredData.error || 'Failed to extract structured data');
      }

      // Step 3: Auto-fill the profile with extracted data and save to database
      if (structuredData.data) {
        const extracted = structuredData.data;
        const userId = await getCurrentUserId();
        if (!userId) {
          throw new Error('Not authenticated');
        }

        // Update profile state
        const updatedProfile: UserProfileDefaults = {
          ...profile,
          user_id: userId, // Ensure user_id is always set
          full_name: extracted.full_name || profile?.full_name,
          email: extracted.email || profile?.email,
          phone: extracted.phone || profile?.phone,
          location: extracted.location || profile?.location,
          summary: extracted.summary || profile?.summary,
          skills: extracted.skills && extracted.skills.length > 0 ? extracted.skills : profile?.skills || [],
          experience: extracted.experience && extracted.experience.length > 0 ? extracted.experience : profile?.experience || [],
          education: extracted.education && extracted.education.length > 0 ? extracted.education : profile?.education || [],
          certifications: extracted.certifications && extracted.certifications.length > 0 ? extracted.certifications : profile?.certifications || [],
          projects: extracted.projects && extracted.projects.length > 0 ? extracted.projects : profile?.projects || [],
          languages: extracted.languages && extracted.languages.length > 0 ? extracted.languages : profile?.languages || [],
          awards: extracted.awards && extracted.awards.length > 0 ? extracted.awards : profile?.awards || [],
          service: extracted.service && extracted.service.length > 0 ? extracted.service : profile?.service || [],
        };

        setProfile(updatedProfile);

        // Save to database
        const { error: saveError } = await supabase
          .from('user_profile_defaults')
          .upsert({
            ...updatedProfile,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (saveError) {
          console.error('Error saving profile:', saveError);
          // Don't throw - profile is updated in state even if save fails
        }

        alert('Resume parsed and profile updated!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload and parse resume');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  }

  function downloadDocx(base64: string, filename: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authChecked || loading) {
    return (
      <div className="lg:ml-64 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:ml-64 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Credits Display */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-300">Credits Remaining</h3>
              <p className="text-2xl font-bold text-amber-400">
                {credits.total >= 999999 ? '∞' : credits.remaining}
              </p>
            </div>
            {credits.total < 999999 && credits.remaining < 5 && (
              <button
                onClick={() => router.push('/resume/settings')}
                className="px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
              >
                Add Credits
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-400">
            {error}
          </div>
        )}

        {!generatedContent ? (
          <>
            {/* Step 1: Upload Resume Section */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold">1</span>
                <h2 className="text-lg font-semibold">Upload Your Resume</h2>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Upload your master resume to automatically update your profile information.
              </p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={uploading || parsing}
                className="block w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-black hover:file:bg-amber-300 disabled:opacity-50"
              />
              {uploading && <p className="text-xs text-amber-400 mt-2">Uploading and parsing file...</p>}
              {parsing && <p className="text-xs text-amber-400 mt-2">Extracting structured data from resume...</p>}
            </div>

            {/* Profile Information Section */}
            {profile && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                <h2 className="text-lg font-semibold mb-4">Your Profile Information</h2>
                <p className="text-xs text-slate-400 mb-4">
                  This information is used to generate your resume. Update it here or in Settings.
                </p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={profile.full_name || ''}
                        onChange={(e) => {
                          const updated: UserProfileDefaults = { ...profile!, full_name: e.target.value };
                          setProfile(updated);
                        }}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={profile.email || ''}
                        onChange={(e) => {
                          const updated: UserProfileDefaults = { ...profile!, email: e.target.value };
                          setProfile(updated);
                        }}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={profile.phone || ''}
                        onChange={(e) => {
                          const updated: UserProfileDefaults = { ...profile!, phone: e.target.value };
                          setProfile(updated);
                        }}
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Location</label>
                      <input
                        type="text"
                        value={profile.location || ''}
                        onChange={(e) => {
                          const updated: UserProfileDefaults = { ...profile!, location: e.target.value };
                          setProfile(updated);
                        }}
                        placeholder="City, State"
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Professional Summary</label>
                    <textarea
                      value={profile.summary || ''}
                      onChange={(e) => {
                        const updated: UserProfileDefaults = { ...profile!, summary: e.target.value };
                        setProfile(updated);
                      }}
                      rows={4}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Skills (comma-separated)</label>
                    <input
                      type="text"
                      value={Array.isArray(profile.skills) ? profile.skills.join(', ') : ''}
                      onChange={(e) => {
                        const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        const updated: UserProfileDefaults = { ...profile!, skills };
                        setProfile(updated);
                      }}
                      placeholder="JavaScript, React, Node.js, Python..."
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  
                  {/* Experience */}
                  {profile.experience && profile.experience.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Work Experience ({profile.experience.length} position{profile.experience.length > 1 ? 's' : ''})</label>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {profile.experience.map((exp: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-900 rounded border border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                              <div>
                                <span className="text-xs text-slate-400">Title:</span>
                                <span className="ml-2 text-sm text-slate-200 font-semibold">{exp.title || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-xs text-slate-400">Company:</span>
                                <span className="ml-2 text-sm text-slate-200">{exp.company || 'N/A'}</span>
                              </div>
                            </div>
                            {exp.startDate && (
                              <div className="text-xs text-slate-400">
                                {exp.startDate} - {exp.endDate || 'Present'}
                              </div>
                            )}
                            {exp.bullets && exp.bullets.length > 0 && (
                              <div className="mt-2">
                                <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                                  {exp.bullets.slice(0, 3).map((bullet: string, bIdx: number) => (
                                    <li key={bIdx}>{bullet}</li>
                                  ))}
                                  {exp.bullets.length > 3 && (
                                    <li className="text-slate-500">... and {exp.bullets.length - 3} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Edit full experience details in <button onClick={() => router.push('/resume/settings')} className="text-amber-400 hover:underline">Settings</button>
                      </p>
                    </div>
                  )}

                  {/* Education */}
                  {profile.education && profile.education.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Education ({profile.education.length} entry{profile.education.length > 1 ? 'ies' : 'y'})</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {profile.education.map((edu: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-900 rounded border border-slate-800">
                            <div className="text-sm text-slate-200">
                              <span className="font-semibold">{edu.degree || 'N/A'}</span>
                              {edu.institution && <span> from {edu.institution}</span>}
                            </div>
                            {(edu.graduationDate || edu.gpa) && (
                              <div className="text-xs text-slate-400 mt-1">
                                {edu.graduationDate && <span>{edu.graduationDate}</span>}
                                {edu.gpa && <span className="ml-2">GPA: {edu.gpa}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Edit full education details in <button onClick={() => router.push('/resume/settings')} className="text-amber-400 hover:underline">Settings</button>
                      </p>
                    </div>
                  )}

                  {/* Certifications */}
                  {profile.certifications && profile.certifications.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Certifications ({profile.certifications.length})</label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {profile.certifications.map((cert: any, idx: number) => (
                          <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-900 rounded border border-slate-800">
                            {cert.name}{cert.issuer && ` from ${cert.issuer}`}{cert.date && ` (${cert.date})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {profile.projects && profile.projects.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Projects ({profile.projects.length})</label>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {profile.projects.map((proj: any, idx: number) => (
                          <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-900 rounded border border-slate-800">
                            <span className="font-semibold text-slate-300">{proj.name}</span>
                            {proj.description && <span>: {proj.description.substring(0, 100)}{proj.description.length > 100 ? '...' : ''}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {profile.languages && profile.languages.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Languages</label>
                      <div className="text-sm text-slate-400">
                        {profile.languages.map((lang: any, idx: number) => (
                          <span key={idx} className="inline-block mr-3 mb-2">
                            {lang.name} ({lang.proficiency || 'N/A'})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Awards */}
                  {profile.awards && profile.awards.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Awards ({profile.awards.length})</label>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {profile.awards.map((award: any, idx: number) => (
                          <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-900 rounded border border-slate-800">
                            {award.title}{award.issuer && ` from ${award.issuer}`}{award.date && ` (${award.date})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Service/Volunteer */}
                  {profile.service && profile.service.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Service & Volunteer ({profile.service.length})</label>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {profile.service.map((svc: any, idx: number) => (
                          <div key={idx} className="text-xs text-slate-400 p-2 bg-slate-900 rounded border border-slate-800">
                            {svc.role} at {svc.organization}
                            {svc.startDate && <span className="ml-2">({svc.startDate} - {svc.endDate || 'Present'})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick save button */}
                  <button
                    onClick={async () => {
                      if (!profile) return;
                      try {
                        const userId = await getCurrentUserId();
                        if (!userId) {
                          setError('Not authenticated');
                          return;
                        }

                        const { error: saveError } = await supabase
                          .from('user_profile_defaults')
                          .upsert({
                            ...profile,
                            updated_at: new Date().toISOString(),
                          }, {
                            onConflict: 'user_id',
                          });

                        if (saveError) throw saveError;
                        alert('Profile updated successfully!');
                      } catch (err) {
                        console.error('Save error:', err);
                        setError(err instanceof Error ? err.message : 'Failed to save profile');
                      }
                    }}
                    className="w-full px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Job Information Section */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold">2</span>
                <h2 className="text-lg font-semibold">Upload Job Description & Generate Resume</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Job Title *</label>
                  <input
                    type="text"
                    value={formData.job_title || ''}
                    onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    placeholder="Senior Software Engineer"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Company Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.company_name || ''}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Acme Corporation"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Job Type</label>
                    <select
                      value={formData.job_type || 'private_sector'}
                      onChange={(e) => setFormData({ ...formData, job_type: e.target.value as JobType })}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="private_sector">Private Sector</option>
                      <option value="federal_government">Federal Government</option>
                      <option value="internship">Internship</option>
                      <option value="apprenticeship">Apprenticeship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Tone</label>
                    <select
                      value={formData.tone || 'professional'}
                      onChange={(e) => setFormData({ ...formData, tone: e.target.value as Tone })}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="professional">Professional</option>
                      <option value="federal">Federal</option>
                      <option value="private">Private Sector</option>
                      <option value="internship">Internship</option>
                      <option value="friendly">Friendly</option>
                      <option value="confident">Confident</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-slate-300">Job Description *</label>
                    <button
                      type="button"
                      onClick={parseJobDescription}
                      disabled={parsingJobDescription || !formData.job_description?.trim()}
                      className="px-3 py-1 text-xs rounded-md border border-amber-500/50 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {parsingJobDescription ? 'Parsing...' : 'Parse Sections'}
                    </button>
                  </div>
                  <textarea
                    value={formData.job_description || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, job_description: e.target.value });
                      // Clear parsed sections when job description changes
                      if (jobDescriptionSections.length > 0) {
                        setJobDescriptionSections([]);
                        setFormData(prev => ({ ...prev, parsed_job_description: undefined }));
                      }
                    }}
                    placeholder="Paste the full job description here..."
                    rows={10}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                  />
                  {jobDescriptionSections.length > 0 && (
                    <div className="mt-3 p-3 bg-slate-900 rounded border border-amber-500/30">
                      <p className="text-xs text-amber-300 font-semibold mb-2">
                        Detected Sections ({jobDescriptionSections.length}):
                      </p>
                      <div className="space-y-1">
                        {jobDescriptionSections.map((section, idx) => (
                          <div key={idx} className="text-xs text-slate-400">
                            <span className="font-semibold text-slate-300">{section.header}</span>
                            {section.content && (
                              <span className="ml-2">
                                ({section.content.substring(0, 50)}{section.content.length > 50 ? '...' : ''})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        The generated resume will match this format structure.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Template Selection */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
              <h2 className="text-lg font-semibold mb-4">Template Selection</h2>
              
              {/* Resume Templates */}
              <div className="mb-6">
                <label className="block text-sm text-slate-300 mb-3">Resume Template</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {templates.resume.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, resume_template_id: t.id })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        formData.resume_template_id === t.id
                          ? 'border-amber-500 bg-amber-950/20'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 mb-2">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-slate-400 mb-3">{t.description}</div>
                      )}
                      {/* Template Preview */}
                      <div className="bg-slate-800 rounded p-3 mb-2 border border-slate-700">
                        <ResumeTemplatePreview template={t} />
                      </div>
                      <div className="text-xs text-slate-500">
                        Font: {t.layout_config?.font || 'Arial'} | Size: {t.layout_config?.fontSize || 11}pt
                      </div>
                    </button>
                  ))}
                </div>
                {templates.resume.length > 3 && (
                  <select
                    value={formData.resume_template_id || ''}
                    onChange={(e) => setFormData({ ...formData, resume_template_id: e.target.value })}
                    className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Or select another template...</option>
                    {templates.resume.slice(3).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Cover Letter Templates */}
              <div>
                <label className="block text-sm text-slate-300 mb-3">Cover Letter Template</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {templates.coverLetter.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, cover_letter_template_id: t.id })}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        formData.cover_letter_template_id === t.id
                          ? 'border-amber-500 bg-amber-950/20'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 mb-2">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-slate-400 mb-3">{t.description}</div>
                      )}
                      {/* Template Preview */}
                      <div className="bg-slate-800 rounded p-3 mb-2 border border-slate-700">
                        <CoverLetterTemplatePreview template={t} />
                      </div>
                      <div className="text-xs text-slate-500">
                        Font: {t.layout_config?.font || 'Arial'} | Size: {t.layout_config?.fontSize || 11}pt
                      </div>
                    </button>
                  ))}
                </div>
                {templates.coverLetter.length > 3 && (
                  <select
                    value={formData.cover_letter_template_id || ''}
                    onChange={(e) => setFormData({ ...formData, cover_letter_template_id: e.target.value })}
                    className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Or select another template...</option>
                    {templates.coverLetter.slice(3).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Options Section */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
              <h2 className="text-lg font-semibold mb-4">Options & Preferences</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_awards || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_awards: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Awards</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_service || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_service: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Service</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_languages || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_languages: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Languages</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_certifications || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_certifications: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Certifications</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_projects || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_projects: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Projects</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.options?.show_salary || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          options: { ...formData.options, show_salary: e.target.checked },
                        })
                      }
                      className="rounded border-slate-700"
                    />
                    <span className="text-sm text-slate-300">Show Salary</span>
                  </label>
                </div>

                {formData.options?.show_salary && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Former Salary (Optional)</label>
                      <input
                        type="text"
                        value={formData.options?.former_salary || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            options: { ...formData.options, former_salary: e.target.value },
                          })
                        }
                        placeholder="$75,000"
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Desired Salary (Optional)</label>
                      <input
                        type="text"
                        value={formData.options?.desired_salary || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            options: { ...formData.options, desired_salary: e.target.value },
                          })
                        }
                        placeholder="$85,000"
                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800">
                  <label className="block text-sm text-slate-300 mb-2">Resume Length</label>
                  <select
                    value={formData.options?.length || '1-page'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        options: { ...formData.options, length: e.target.value as '1-page' | '2-page' },
                      })
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="1-page">1 Page</option>
                    <option value="2-page">2 Pages</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Generate Button */}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold">3</span>
                <h2 className="text-lg font-semibold">Generate Resume</h2>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !formData.job_title || !formData.job_description || (credits.total < 999999 && credits.remaining < 1)}
                className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating Resume & Cover Letter...' : 'Generate Resume & Cover Letter'}
              </button>
              {credits.total < 999999 && credits.remaining < 1 && (
                <p className="text-xs text-red-400 text-center mt-2">
                  Insufficient credits. Please add credits to continue.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Step 4: Edit/Finalize Resume */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold">4</span>
                  <h2 className="text-xl font-semibold">Edit & Finalize Resume</h2>
                </div>
                <button
                  onClick={() => setGeneratedContent(null)}
                  className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Generate Another
                </button>
              </div>

              {/* Resume Preview */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Resume Preview</h3>
                  <button
                    onClick={async () => {
                      // Parse the formatted text back to structured format and regenerate DOCX
                      try {
                        const userId = await getCurrentUserId();
                        if (!userId) {
                          setError('You must be logged in to download');
                          return;
                        }
                        
                        const response = await fetch('/api/resume/regenerate-docx', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            generation_id: generatedContent.generation_id, // Pass generation ID to update archive
                            userId, // Pass userId from client to avoid auth issues
                            resume: generatedContent.resume,
                            resume_formatted_text: resumeFormattedText, // Pass the edited text
                            user_profile: profile, // Pass user profile for header
                            resume_template_id: formData.resume_template_id, // Pass template ID
                          }),
                        });

                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to regenerate DOCX');
                        }

                        if (data.resume_docx_base64) {
                          downloadDocx(data.resume_docx_base64, `${formData.job_title || 'resume'}_resume.docx`);
                        }
                      } catch (error) {
                        console.error('Error regenerating DOCX:', error);
                        setError(error instanceof Error ? error.message : 'Failed to download resume');
                      }
                    }}
                    className="px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
                  >
                    Download DOCX
                  </button>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                  <textarea
                    value={resumeFormattedText}
                    onChange={(e) => {
                      setResumeFormattedText(e.target.value);
                      // Update the structured content when text changes
                      // We'll parse it back when downloading
                    }}
                    className="w-full h-[600px] rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 font-mono focus:border-amber-500 focus:outline-none resize-none whitespace-pre-wrap"
                    placeholder="Resume content will appear here..."
                  />
                </div>
              </div>

              {/* Step 5: Generate Cover Letter */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold">5</span>
                  <h3 className="text-lg font-semibold">Cover Letter Preview</h3>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div></div>
                  <button
                    onClick={async () => {
                      // Parse the formatted text back to structured format and regenerate DOCX
                      try {
                        const userId = await getCurrentUserId();
                        if (!userId) {
                          setError('You must be logged in to download');
                          return;
                        }
                        
                        const response = await fetch('/api/resume/regenerate-docx', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            generation_id: generatedContent.generation_id, // Pass generation ID to update archive
                            userId, // Pass userId from client to avoid auth issues
                            cover_letter: generatedContent.cover_letter,
                            cover_letter_formatted_text: coverLetterFormattedText, // Pass the edited text
                            cover_letter_template_id: formData.cover_letter_template_id, // Pass template ID
                          }),
                        });

                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to regenerate DOCX');
                        }

                        if (data.cover_letter_docx_base64) {
                          downloadDocx(data.cover_letter_docx_base64, `${formData.job_title || 'cover_letter'}_cover_letter.docx`);
                        }
                      } catch (error) {
                        console.error('Error regenerating DOCX:', error);
                        setError(error instanceof Error ? error.message : 'Failed to download cover letter');
                      }
                    }}
                    className="px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 transition-colors"
                  >
                    Download DOCX
                  </button>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
                  <textarea
                    value={coverLetterFormattedText}
                    onChange={(e) => {
                      setCoverLetterFormattedText(e.target.value);
                    }}
                    className="w-full h-[600px] rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none whitespace-pre-wrap"
                    placeholder="Cover letter content will appear here..."
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResumePreview({
  content,
  onChange,
}: {
  content: GeneratedResumeContent;
  onChange: (updated: GeneratedResumeContent) => void;
}) {
  return (
    <div className="text-sm text-slate-300 space-y-4">
      {content.profile !== undefined && (
        <div>
          <h4 className="font-semibold text-amber-300 mb-2">Professional Summary</h4>
          <textarea
            value={content.profile || ''}
            onChange={(e) => {
              onChange({ ...content, profile: e.target.value });
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
            rows={4}
          />
        </div>
      )}
      {content.experience && content.experience.length > 0 && (
        <div>
          <h4 className="font-semibold text-amber-300 mb-2">Experience</h4>
          {content.experience.map((exp, idx) => (
            <div key={idx} className="mb-4 p-3 bg-slate-800 rounded border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={exp.title}
                  onChange={(e) => {
                    const updated = [...content.experience];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    onChange({ ...content, experience: updated });
                  }}
                  className="font-semibold bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  placeholder="Job Title"
                />
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => {
                    const updated = [...content.experience];
                    updated[idx] = { ...updated[idx], company: e.target.value };
                    onChange({ ...content, experience: updated });
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  placeholder="Company"
                />
              </div>
              <input
                type="text"
                value={exp.dates}
                onChange={(e) => {
                  const updated = [...content.experience];
                  updated[idx] = { ...updated[idx], dates: e.target.value };
                  onChange({ ...content, experience: updated });
                }}
                className="text-xs text-slate-400 bg-slate-900 border border-slate-600 rounded px-2 py-1 mb-2 w-full focus:border-amber-500 focus:outline-none"
                placeholder="Dates"
              />
              <div className="space-y-2">
                {exp.bullets.map((bullet, bIdx) => (
                  <textarea
                    key={bIdx}
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...content.experience];
                      const updatedBullets = [...updated[idx].bullets];
                      updatedBullets[bIdx] = e.target.value;
                      updated[idx] = { ...updated[idx], bullets: updatedBullets };
                      onChange({ ...content, experience: updated });
                    }}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                    rows={2}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...content.experience];
                    updated[idx] = { ...updated[idx], bullets: [...updated[idx].bullets, ''] };
                    onChange({ ...content, experience: updated });
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  + Add Bullet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {content.skills !== undefined && (
        <div>
          <h4 className="font-semibold text-amber-300 mb-2">Core Skills & Tools</h4>
          <input
            type="text"
            value={content.skills.join(', ')}
            onChange={(e) => {
              const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              onChange({ ...content, skills });
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
            placeholder="Skill 1, Skill 2, Skill 3..."
          />
        </div>
      )}
      {content.education && content.education.length > 0 && (
        <div>
          <h4 className="font-semibold text-amber-300 mb-2">Education</h4>
          {content.education.map((edu, idx) => (
            <div key={idx} className="mb-2 p-2 bg-slate-800 rounded border border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={edu.degree || ''}
                  onChange={(e) => {
                    const updated = [...content.education];
                    updated[idx] = { ...updated[idx], degree: e.target.value };
                    onChange({ ...content, education: updated });
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  placeholder="Degree"
                />
                <input
                  type="text"
                  value={edu.institution || ''}
                  onChange={(e) => {
                    const updated = [...content.education];
                    updated[idx] = { ...updated[idx], institution: e.target.value };
                    onChange({ ...content, education: updated });
                  }}
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  placeholder="Institution"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {content.role_alignment && (
        <div>
          <h4 className="font-semibold text-amber-300 mb-2">Role Alignment</h4>
          {content.role_alignment.summary_of_duties && content.role_alignment.summary_of_duties.length > 0 && (
            <div className="mb-3">
              <input
                type="text"
                value={content.role_alignment.summary_of_duties_header || 'Summary of Duties'}
                onChange={(e) => {
                  onChange({
                    ...content,
                    role_alignment: {
                      ...content.role_alignment!,
                      summary_of_duties_header: e.target.value,
                    },
                  });
                }}
                className="font-semibold text-slate-300 mb-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-amber-500 focus:outline-none w-full"
                placeholder="Section Header"
              />
              <div className="space-y-2">
                {content.role_alignment.summary_of_duties.map((bullet, idx) => (
                  <textarea
                    key={idx}
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...content.role_alignment!.summary_of_duties!];
                      updated[idx] = e.target.value;
                      onChange({
                        ...content,
                        role_alignment: {
                          ...content.role_alignment!,
                          summary_of_duties: updated,
                        },
                      });
                    }}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                    rows={2}
                  />
                ))}
              </div>
            </div>
          )}
          {content.role_alignment.essential_functions && content.role_alignment.essential_functions.length > 0 && (
            <div className="mb-3">
              <input
                type="text"
                value={content.role_alignment.essential_functions_header || 'Essential Functions'}
                onChange={(e) => {
                  onChange({
                    ...content,
                    role_alignment: {
                      ...content.role_alignment!,
                      essential_functions_header: e.target.value,
                    },
                  });
                }}
                className="font-semibold text-slate-300 mb-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-amber-500 focus:outline-none w-full"
                placeholder="Section Header"
              />
              <div className="space-y-2">
                {content.role_alignment.essential_functions.map((bullet, idx) => (
                  <textarea
                    key={idx}
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...content.role_alignment!.essential_functions!];
                      updated[idx] = e.target.value;
                      onChange({
                        ...content,
                        role_alignment: {
                          ...content.role_alignment!,
                          essential_functions: updated,
                        },
                      });
                    }}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                    rows={2}
                  />
                ))}
              </div>
            </div>
          )}
          {content.role_alignment.minimum_qualifications && content.role_alignment.minimum_qualifications.length > 0 && (
            <div className="mb-3">
              <input
                type="text"
                value={content.role_alignment.minimum_qualifications_header || 'Minimum Qualifications'}
                onChange={(e) => {
                  onChange({
                    ...content,
                    role_alignment: {
                      ...content.role_alignment!,
                      minimum_qualifications_header: e.target.value,
                    },
                  });
                }}
                className="font-semibold text-slate-300 mb-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm focus:border-amber-500 focus:outline-none w-full"
                placeholder="Section Header"
              />
              <div className="space-y-2">
                {content.role_alignment.minimum_qualifications.map((bullet, idx) => (
                  <textarea
                    key={idx}
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...content.role_alignment!.minimum_qualifications!];
                      updated[idx] = e.target.value;
                      onChange({
                        ...content,
                        role_alignment: {
                          ...content.role_alignment!,
                          minimum_qualifications: updated,
                        },
                      });
                    }}
                    className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                    rows={2}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {content.custom_sections && content.custom_sections.length > 0 && (
        <div>
          {content.custom_sections.map((section, idx) => (
            <div key={idx} className="mb-4">
              <h4 className="font-semibold text-amber-300 mb-2">{section.header}</h4>
              <p className="whitespace-pre-wrap">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Template Preview Components
function ResumeTemplatePreview({ template }: { template: Template }) {
  const font = template.layout_config?.font || 'Arial';
  const fontSize = template.layout_config?.fontSize || 11;
  const isFederal = template.name.toLowerCase().includes('federal');
  const isInternship = template.name.toLowerCase().includes('internship');
  const isModern = template.name.toLowerCase().includes('modern');
  
  return (
    <div className="text-xs" style={{ fontFamily: font, fontSize: `${fontSize * 0.75}px`, lineHeight: '1.3' }}>
      {/* Header - Different styles per template */}
      <div className={`mb-1.5 ${isFederal ? 'text-center' : 'text-left'}`}>
        <div className={`font-bold text-slate-200 ${isFederal ? 'text-sm mb-0.5' : 'text-xs mb-0.5'}`}>
          JOHN DOE
        </div>
        <div className="text-slate-400 text-[10px]">
          {isFederal ? (
            <div>123 Main Street, City, State 12345</div>
          ) : (
            <div>john.doe@email.com | (555) 123-4567 | City, State</div>
          )}
        </div>
      </div>
      {isFederal ? (
        <div className="border-t-2 border-slate-600 my-1"></div>
      ) : (
        <div className="border-t border-slate-600 my-1"></div>
      )}
      
      {/* Professional Summary */}
      <div className="mb-1.5">
        <div className={`font-semibold text-slate-300 mb-0.5 ${isFederal ? 'text-xs uppercase' : 'text-[10px]'}`}>
          {isFederal ? 'PROFESSIONAL SUMMARY' : isInternship ? 'Summary' : 'Professional Summary'}
        </div>
        <div className="text-slate-400 text-[10px] leading-tight">
          {isInternship ? 'Recent graduate with...' : 'Experienced professional with expertise in...'}
        </div>
      </div>
      
      {/* Experience */}
      <div className="mb-1.5">
        <div className={`font-semibold text-slate-300 mb-0.5 ${isFederal ? 'text-xs uppercase' : 'text-[10px]'}`}>
          {isFederal ? 'PROFESSIONAL EXPERIENCE' : isInternship ? 'Experience' : 'Experience'}
        </div>
        <div className="text-slate-400 text-[10px] leading-tight">
          <div className="font-medium">
            {isFederal ? 'SOFTWARE ENGINEER' : 'Software Engineer'} {isFederal ? '' : '|'} {isFederal ? '' : 'Company Name'}
          </div>
          <div className="text-slate-500 text-[9px]">2020 - Present</div>
          {!isInternship && (
            <div className="ml-2 text-[9px]">• Led development of key features...</div>
          )}
        </div>
      </div>
      
      {/* Skills */}
      <div>
        <div className={`font-semibold text-slate-300 mb-0.5 ${isFederal ? 'text-xs uppercase' : 'text-[10px]'}`}>
          {isFederal ? 'CORE SKILLS' : 'Skills'}
        </div>
        <div className="text-slate-400 text-[10px] leading-tight">
          {isFederal ? 'JavaScript; React; Node.js; Python' : 'JavaScript, React, Node.js, Python'}
        </div>
      </div>
    </div>
  );
}

function CoverLetterTemplatePreview({ template }: { template: Template }) {
  const font = template.layout_config?.font || 'Arial';
  const fontSize = template.layout_config?.fontSize || 11;
  const isFederal = template.name.toLowerCase().includes('federal');
  const isModern = template.name.toLowerCase().includes('modern');
  
  return (
    <div className="text-xs" style={{ fontFamily: font, fontSize: `${fontSize * 0.75}px`, lineHeight: '1.4' }}>
      {/* Header - Different for Federal */}
      {isFederal && (
        <div className="text-right text-slate-400 mb-2 text-[10px]">
          <div className="font-semibold">John Doe</div>
          <div>123 Main Street</div>
          <div>City, State 12345</div>
          <div>john.doe@email.com</div>
          <div>(555) 123-4567</div>
        </div>
      )}
      
      {!isFederal && (
        <div className="text-right text-slate-400 mb-2 text-[10px]">
          <div>John Doe</div>
          <div>john.doe@email.com | (555) 123-4567</div>
        </div>
      )}
      
      <div className="text-slate-400 mb-1.5 text-[10px]">
        {isFederal ? 'Date' : ''}<br />
        {isFederal ? 'Hiring Manager' : 'Dear Hiring Manager,'}
      </div>
      
      <div className="text-slate-300 leading-tight mb-1.5 text-[10px]">
        {isFederal ? (
          <>
            I am writing to express my strong interest in the position. My qualifications align with your requirements...
          </>
        ) : isModern ? (
          <>
            I'm excited to apply for this role. My experience in software development and passion for innovation make me an ideal candidate...
          </>
        ) : (
          <>
            I am writing to express my interest in the position. With my background in software engineering and proven track record...
          </>
        )}
      </div>
      
      <div className="text-slate-300 leading-tight mb-1.5 text-[10px]">
        {isFederal ? (
          <>My experience includes leading technical projects and collaborating with cross-functional teams...</>
        ) : (
          <>My experience includes developing scalable solutions and driving technical excellence...</>
        )}
      </div>
      
      <div className="text-slate-400 mt-2 text-[10px]">
        {isFederal ? (
          <>
            Respectfully,<br />
            John Doe
          </>
        ) : (
          <>
            Sincerely,<br />
            John Doe
          </>
        )}
      </div>
    </div>
  );
}

function CoverLetterPreview({
  content,
  onChange,
}: {
  content: GeneratedCoverLetterContent;
  onChange: (updated: GeneratedCoverLetterContent) => void;
}) {
  return (
    <div className="text-sm text-slate-300 space-y-4">
      {content.subject !== undefined && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Subject</label>
          <input
            type="text"
            value={content.subject || ''}
            onChange={(e) => {
              onChange({ ...content, subject: e.target.value });
            }}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      )}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Greeting</label>
        <input
          type="text"
          value={content.greeting}
          onChange={(e) => {
            onChange({ ...content, greeting: e.target.value });
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Opening</label>
        <textarea
          value={content.opening}
          onChange={(e) => {
            onChange({ ...content, opening: e.target.value });
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
          rows={3}
        />
      </div>
      {content.body && content.body.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Body Paragraphs</label>
          {content.body.map((paragraph, idx) => (
            <textarea
              key={idx}
              value={paragraph}
              onChange={(e) => {
                const updated = [...content.body];
                updated[idx] = e.target.value;
                onChange({ ...content, body: updated });
              }}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none mb-2"
              rows={4}
            />
          ))}
        </div>
      )}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Closing</label>
        <textarea
          value={content.closing}
          onChange={(e) => {
            onChange({ ...content, closing: e.target.value });
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Signature</label>
        <input
          type="text"
          value={content.signature}
          onChange={(e) => {
            onChange({ ...content, signature: e.target.value });
          }}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
