'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@auth/supabaseClient';
import type { UserProfileDefaults, Experience, Education, Certification, Project, Language, Award, Service } from '@/lib/resume/types';

export default function OnboardingPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfileDefaults>>({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
    awards: [],
    service: [],
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Step 3: Auto-fill the form with extracted data
      if (structuredData.data) {
        const extracted = structuredData.data;
        setProfile((prev) => ({
          ...prev,
          full_name: extracted.full_name || prev.full_name,
          email: extracted.email || prev.email,
          phone: extracted.phone || prev.phone,
          location: extracted.location || prev.location,
          summary: extracted.summary || prev.summary,
          skills: extracted.skills && extracted.skills.length > 0 ? extracted.skills : prev.skills,
          experience: extracted.experience && extracted.experience.length > 0 ? extracted.experience : prev.experience,
          education: extracted.education && extracted.education.length > 0 ? extracted.education : prev.education,
          certifications: extracted.certifications && extracted.certifications.length > 0 ? extracted.certifications : prev.certifications,
          projects: extracted.projects && extracted.projects.length > 0 ? extracted.projects : prev.projects,
          languages: extracted.languages && extracted.languages.length > 0 ? extracted.languages : prev.languages,
          awards: extracted.awards && extracted.awards.length > 0 ? extracted.awards : prev.awards,
          service: extracted.service && extracted.service.length > 0 ? extracted.service : prev.service,
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload and parse resume');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!profile.full_name || !profile.email || !profile.summary) {
      setError('Please fill in at least Full Name, Email, and Professional Summary');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Save profile using Supabase directly
      const { error: upsertError } = await supabase
        .from('user_profile_defaults')
        .upsert({
          user_id: user.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone || null,
          location: profile.location || null,
          summary: profile.summary,
          skills: profile.skills || [],
          experience: profile.experience || [],
          education: profile.education || [],
          certifications: profile.certifications || [],
          projects: profile.projects || [],
          languages: profile.languages || [],
          awards: profile.awards || [],
          service: profile.service || [],
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        throw new Error(upsertError.message || 'Failed to save profile');
      }

      router.push('/resume');
    } catch (error) {
      console.error('Save error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function addExperience() {
    setProfile((prev) => ({
      ...prev,
      experience: [
        ...(prev.experience || []),
        {
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          current: false,
          bullets: [''],
        },
      ],
    }));
  }

  function removeExperience(index: number) {
    setProfile((prev) => {
      const exp = [...(prev.experience || [])];
      exp.splice(index, 1);
      return { ...prev, experience: exp };
    });
  }

  function updateExperience(index: number, field: keyof Experience, value: any) {
    setProfile((prev) => {
      const exp = [...(prev.experience || [])];
      exp[index] = { ...exp[index], [field]: value };
      return { ...prev, experience: exp };
    });
  }

  function addEducation() {
    setProfile((prev) => ({
      ...prev,
      education: [
        ...(prev.education || []),
        {
          degree: '',
          institution: '',
          graduationDate: '',
        },
      ],
    }));
  }

  function removeEducation(index: number) {
    setProfile((prev) => {
      const edu = [...(prev.education || [])];
      edu.splice(index, 1);
      return { ...prev, education: edu };
    });
  }

  function updateEducation(index: number, field: keyof Education, value: any) {
    setProfile((prev) => {
      const edu = [...(prev.education || [])];
      edu[index] = { ...edu[index], [field]: value };
      return { ...prev, education: edu };
    });
  }

  function updateSkills(value: string) {
    const skills = value.split(',').map(s => s.trim()).filter(Boolean);
    setProfile((prev) => ({ ...prev, skills }));
  }

  return (
    <div className="lg:ml-64 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Complete Your Profile</h1>
          <p className="text-slate-400">
            Set up your master resume data. Upload your resume to auto-fill, or enter information manually.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Upload Resume Section */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Upload Your Resume (Optional)</h2>
          <p className="text-sm text-slate-400 mb-4">
            Upload your resume and we'll automatically extract and fill in your information.
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

        {/* Personal Information */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Full Name *</label>
              <input
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={profile.phone || ''}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Location</label>
              <input
                type="text"
                value={profile.location || ''}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="City, State"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-2">Professional Summary *</label>
              <textarea
                value={profile.summary || ''}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                rows={4}
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Skills</h2>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Skills (comma-separated)</label>
            <input
              type="text"
              value={Array.isArray(profile.skills) ? profile.skills.join(', ') : ''}
              onChange={(e) => updateSkills(e.target.value)}
              placeholder="JavaScript, React, Node.js, Python..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Work Experience */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Work Experience</h2>
            <button
              onClick={addExperience}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Experience
            </button>
          </div>
          {(profile.experience || []).map((exp, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Experience #{idx + 1}</h3>
                <button
                  onClick={() => removeExperience(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Job Title</label>
                  <input
                    type="text"
                    value={exp.title || ''}
                    onChange={(e) => updateExperience(idx, 'title', e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Company</label>
                  <input
                    type="text"
                    value={exp.company || ''}
                    onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Start Date</label>
                  <input
                    type="text"
                    value={exp.startDate || ''}
                    onChange={(e) => updateExperience(idx, 'startDate', e.target.value)}
                    placeholder="Month Year"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">End Date</label>
                  <input
                    type="text"
                    value={exp.endDate || ''}
                    onChange={(e) => updateExperience(idx, 'endDate', e.target.value)}
                    placeholder="Month Year or 'Present'"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Key Achievements (one per line)</label>
                <textarea
                  value={(exp.bullets || []).join('\n')}
                  onChange={(e) => updateExperience(idx, 'bullets', e.target.value.split('\n').filter(Boolean))}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Education */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Education</h2>
            <button
              onClick={addEducation}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Education
            </button>
          </div>
          {(profile.education || []).map((edu, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Education #{idx + 1}</h3>
                <button
                  onClick={() => removeEducation(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Degree</label>
                  <input
                    type="text"
                    value={edu.degree || ''}
                    onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Institution</label>
                  <input
                    type="text"
                    value={edu.institution || ''}
                    onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Graduation Date</label>
                  <input
                    type="text"
                    value={edu.graduationDate || ''}
                    onChange={(e) => updateEducation(idx, 'graduationDate', e.target.value)}
                    placeholder="Month Year"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">GPA (Optional)</label>
                  <input
                    type="text"
                    value={edu.gpa || ''}
                    onChange={(e) => updateEducation(idx, 'gpa', e.target.value)}
                    placeholder="3.8/4.0"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Certifications</h2>
            <button
              onClick={() => {
                setProfile((prev) => ({
                  ...prev,
                  certifications: [
                    ...(prev.certifications || []),
                    { name: '', issuer: '', date: '' },
                  ],
                }));
              }}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Certification
            </button>
          </div>
          {(profile.certifications || []).map((cert, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Certification #{idx + 1}</h3>
                <button
                  onClick={() => {
                    const certs = [...(profile.certifications || [])];
                    certs.splice(idx, 1);
                    setProfile({ ...profile, certifications: certs });
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Certification Name</label>
                  <input
                    type="text"
                    value={cert.name || ''}
                    onChange={(e) => {
                      const certs = [...(profile.certifications || [])];
                      certs[idx] = { ...certs[idx], name: e.target.value };
                      setProfile({ ...profile, certifications: certs });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Issuing Organization</label>
                  <input
                    type="text"
                    value={cert.issuer || ''}
                    onChange={(e) => {
                      const certs = [...(profile.certifications || [])];
                      certs[idx] = { ...certs[idx], issuer: e.target.value };
                      setProfile({ ...profile, certifications: certs });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Date (Optional)</label>
                <input
                  type="text"
                  value={cert.date || ''}
                  onChange={(e) => {
                    const certs = [...(profile.certifications || [])];
                    certs[idx] = { ...certs[idx], date: e.target.value };
                    setProfile({ ...profile, certifications: certs });
                  }}
                  placeholder="Month Year"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            <button
              onClick={() => {
                setProfile((prev) => ({
                  ...prev,
                  projects: [
                    ...(prev.projects || []),
                    { name: '', description: '', technologies: [] },
                  ],
                }));
              }}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Project
            </button>
          </div>
          {(profile.projects || []).map((proj, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Project #{idx + 1}</h3>
                <button
                  onClick={() => {
                    const projs = [...(profile.projects || [])];
                    projs.splice(idx, 1);
                    setProfile({ ...profile, projects: projs });
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={proj.name || ''}
                  onChange={(e) => {
                    const projs = [...(profile.projects || [])];
                    projs[idx] = { ...projs[idx], name: e.target.value };
                    setProfile({ ...profile, projects: projs });
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Description</label>
                <textarea
                  value={proj.description || ''}
                  onChange={(e) => {
                    const projs = [...(profile.projects || [])];
                    projs[idx] = { ...projs[idx], description: e.target.value };
                    setProfile({ ...profile, projects: projs });
                  }}
                  rows={3}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Technologies (comma-separated)</label>
                <input
                  type="text"
                  value={Array.isArray(proj.technologies) ? proj.technologies.join(', ') : ''}
                  onChange={(e) => {
                    const projs = [...(profile.projects || [])];
                    projs[idx] = {
                      ...projs[idx],
                      technologies: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                    };
                    setProfile({ ...profile, projects: projs });
                  }}
                  placeholder="React, Node.js, MongoDB..."
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Languages */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Languages</h2>
            <button
              onClick={() => {
                setProfile((prev) => ({
                  ...prev,
                  languages: [
                    ...(prev.languages || []),
                    { name: '', proficiency: 'Conversational' },
                  ],
                }));
              }}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Language
            </button>
          </div>
          {(profile.languages || []).map((lang, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Language #{idx + 1}</h3>
                <button
                  onClick={() => {
                    const langs = [...(profile.languages || [])];
                    langs.splice(idx, 1);
                    setProfile({ ...profile, languages: langs });
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Language</label>
                  <input
                    type="text"
                    value={lang.name || ''}
                    onChange={(e) => {
                      const langs = [...(profile.languages || [])];
                      langs[idx] = { ...langs[idx], name: e.target.value };
                      setProfile({ ...profile, languages: langs });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Proficiency</label>
                  <select
                    value={lang.proficiency || 'Conversational'}
                    onChange={(e) => {
                      const langs = [...(profile.languages || [])];
                      langs[idx] = { ...langs[idx], proficiency: e.target.value };
                      setProfile({ ...profile, languages: langs });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Native">Native</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Basic">Basic</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Awards */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Awards & Recognition</h2>
            <button
              onClick={() => {
                setProfile((prev) => ({
                  ...prev,
                  awards: [
                    ...(prev.awards || []),
                    { title: '', issuer: '', date: '' },
                  ],
                }));
              }}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Award
            </button>
          </div>
          {(profile.awards || []).map((award, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Award #{idx + 1}</h3>
                <button
                  onClick={() => {
                    const awards = [...(profile.awards || [])];
                    awards.splice(idx, 1);
                    setProfile({ ...profile, awards });
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Award Title</label>
                <input
                  type="text"
                  value={award.title || ''}
                  onChange={(e) => {
                    const awards = [...(profile.awards || [])];
                    awards[idx] = { ...awards[idx], title: e.target.value };
                    setProfile({ ...profile, awards });
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Issuing Organization (Optional)</label>
                  <input
                    type="text"
                    value={award.issuer || ''}
                    onChange={(e) => {
                      const awards = [...(profile.awards || [])];
                      awards[idx] = { ...awards[idx], issuer: e.target.value };
                      setProfile({ ...profile, awards });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Date (Optional)</label>
                  <input
                    type="text"
                    value={award.date || ''}
                    onChange={(e) => {
                      const awards = [...(profile.awards || [])];
                      awards[idx] = { ...awards[idx], date: e.target.value };
                      setProfile({ ...profile, awards });
                    }}
                    placeholder="Month Year"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Service / Volunteer */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Service & Volunteer Work</h2>
            <button
              onClick={() => {
                setProfile((prev) => ({
                  ...prev,
                  service: [
                    ...(prev.service || []),
                    { organization: '', role: '', startDate: '', endDate: '', current: false },
                  ],
                }));
              }}
              className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors text-sm"
            >
              + Add Service
            </button>
          </div>
          {(profile.service || []).map((svc, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-4 space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-300">Service #{idx + 1}</h3>
                <button
                  onClick={() => {
                    const services = [...(profile.service || [])];
                    services.splice(idx, 1);
                    setProfile({ ...profile, service: services });
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Organization</label>
                  <input
                    type="text"
                    value={svc.organization || ''}
                    onChange={(e) => {
                      const services = [...(profile.service || [])];
                      services[idx] = { ...services[idx], organization: e.target.value };
                      setProfile({ ...profile, service: services });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Role / Position</label>
                  <input
                    type="text"
                    value={svc.role || ''}
                    onChange={(e) => {
                      const services = [...(profile.service || [])];
                      services[idx] = { ...services[idx], role: e.target.value };
                      setProfile({ ...profile, service: services });
                    }}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Start Date</label>
                  <input
                    type="text"
                    value={svc.startDate || ''}
                    onChange={(e) => {
                      const services = [...(profile.service || [])];
                      services[idx] = { ...services[idx], startDate: e.target.value };
                      setProfile({ ...profile, service: services });
                    }}
                    placeholder="Month Year"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-2">End Date</label>
                  <input
                    type="text"
                    value={svc.endDate || ''}
                    onChange={(e) => {
                      const services = [...(profile.service || [])];
                      services[idx] = { ...services[idx], endDate: e.target.value };
                      setProfile({ ...profile, service: services });
                    }}
                    placeholder="Month Year or 'Present'"
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Description (Optional)</label>
                <textarea
                  value={svc.description || ''}
                  onChange={(e) => {
                    const services = [...(profile.service || [])];
                    services[idx] = { ...services[idx], description: e.target.value };
                    setProfile({ ...profile, service: services });
                  }}
                  rows={2}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <button
            onClick={handleSave}
            disabled={saving || !profile.full_name || !profile.email || !profile.summary}
            className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Profile & Continue'}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">
            * Required fields: Full Name, Email, Professional Summary
          </p>
        </div>
      </div>
    </div>
  );
}




