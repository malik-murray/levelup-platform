'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import type { UserProfileDefaults, UserSettings, Template } from '@/lib/resume/types';

export default function SettingsPage() {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creditAmount, setCreditAmount] = useState('10');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Load data using Supabase directly
      const [profileResult, settingsResult, templatesResult, creditsResult] = await Promise.all([
        supabase
          .from('user_profile_defaults')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        Promise.all([
          supabase
            .from('templates')
            .select('*')
            .eq('type', 'resume')
            .order('is_default', { ascending: false }),
          supabase
            .from('templates')
            .select('*')
            .eq('type', 'cover_letter')
            .order('is_default', { ascending: false }),
        ]),
        supabase
          .from('credits')
          .select('*')
          .eq('user_id', user.id)
          .single(),
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data);
      }

      if (settingsResult.data) {
        setSettings(settingsResult.data);
      } else {
        setSettings({
          user_id: user.id,
          default_tone: 'professional',
          default_job_type: 'private_sector',
          default_header_footer_options: {},
          default_visibility_preferences: {},
        });
      }

      const [resumeTemplatesRes, coverLetterTemplatesRes] = templatesResult;
      setTemplates({
        resume: resumeTemplatesRes.data || [],
        coverLetter: coverLetterTemplatesRes.data || [],
      });

      if (creditsResult.data) {
        const credits = creditsResult.data;
        setCredits({
          remaining: credits.total_credits - credits.used_credits,
          total: credits.total_credits,
          used: credits.used_credits,
        });
      } else {
        setCredits({ remaining: 0, total: 0, used: 0 });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      // Save profile using Supabase directly
      const { error } = await supabase
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
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw new Error(error.message || 'Failed to save profile');
      }

      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      // Save settings using Supabase directly
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          default_tone: settings.default_tone,
          default_job_type: settings.default_job_type,
          default_resume_template_id: settings.default_resume_template_id || null,
          default_cover_letter_template_id: settings.default_cover_letter_template_id || null,
          default_header_footer_options: settings.default_header_footer_options || {},
          default_visibility_preferences: settings.default_visibility_preferences || {},
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw new Error(error.message || 'Failed to save settings');
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCredits() {
    const amount = parseInt(creditAmount, 10);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      // Get current credits
      const { data: currentCredits } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (currentCredits) {
        // Update existing credits
        const { error } = await supabase
          .from('credits')
          .update({
            total_credits: currentCredits.total_credits + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new credits record
        const { error } = await supabase
          .from('credits')
          .insert({
            user_id: user.id,
            total_credits: amount,
            used_credits: 0,
          });

        if (error) throw error;
      }

      await loadData();
      alert(`Added ${amount} credits successfully!`);
      setCreditAmount('10');
    } catch (error) {
      console.error('Add credits error:', error);
      alert(error instanceof Error ? error.message : 'Failed to add credits');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
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
        setProfile((prev) => {
          if (!prev) return prev;
          return {
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
          };
        });
        alert('Resume parsed and form updated! Review the fields and click "Save Profile" to save changes.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload and parse resume');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  }

  async function handleUnlimitedCredits() {
    if (!confirm('Set unlimited credits for testing? This will set your credits to 999,999.')) {
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      // Get current credits
      const { data: currentCredits } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const unlimitedAmount = 999999;

      if (currentCredits) {
        // Update existing credits to unlimited
        const { error } = await supabase
          .from('credits')
          .update({
            total_credits: unlimitedAmount,
            used_credits: 0, // Reset used credits too
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new credits record with unlimited
        const { error } = await supabase
          .from('credits')
          .insert({
            user_id: user.id,
            total_credits: unlimitedAmount,
            used_credits: 0,
          });

        if (error) throw error;
      }

      await loadData();
      alert('Unlimited credits enabled for testing!');
    } catch (error) {
      console.error('Unlimited credits error:', error);
      alert(error instanceof Error ? error.message : 'Failed to set unlimited credits');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Credits Section */}
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
          <h2 className="text-lg font-semibold mb-4">Credits</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-400">Remaining Credits</p>
              <p className="text-3xl font-bold text-amber-400">{credits.remaining}</p>
              <p className="text-xs text-slate-500 mt-1">
                Total: {credits.total} | Used: {credits.used}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-4">
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="10"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleAddCredits}
                  disabled={saving}
                  className="px-4 py-2 rounded-md bg-amber-400 text-black font-semibold hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add Credits
                </button>
              </div>
              <button
                onClick={handleUnlimitedCredits}
                disabled={saving}
                className="w-full px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Setting...' : 'Set Unlimited Credits (Testing)'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Note: In production, this would integrate with a payment system.
            </p>
          </div>
        </div>

        {/* Default Settings */}
        {settings && (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
            <h2 className="text-lg font-semibold mb-4">Default Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Default Tone</label>
                <select
                  value={settings.default_tone}
                  onChange={(e) => setSettings({ ...settings, default_tone: e.target.value as any })}
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
              <div>
                <label className="block text-sm text-slate-300 mb-2">Default Job Type</label>
                <select
                  value={settings.default_job_type}
                  onChange={(e) => setSettings({ ...settings, default_job_type: e.target.value as any })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="private_sector">Private Sector</option>
                  <option value="federal_government">Federal Government</option>
                  <option value="internship">Internship</option>
                  <option value="apprenticeship">Apprenticeship</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Default Resume Template</label>
                <select
                  value={settings.default_resume_template_id || ''}
                  onChange={(e) => setSettings({ ...settings, default_resume_template_id: e.target.value || undefined })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Default</option>
                  {templates.resume.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Default Cover Letter Template</label>
                <select
                  value={settings.default_cover_letter_template_id || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, default_cover_letter_template_id: e.target.value || undefined })
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Default</option>
                  {templates.coverLetter.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}

        {/* Profile Section */}
        {profile && (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Profile</h2>
            </div>
            
            {/* Upload Resume Section */}
            <div className="mb-6 p-4 rounded-lg border border-slate-700 bg-slate-900">
              <h3 className="text-sm font-semibold mb-2 text-slate-300">Update Resume from File</h3>
              <p className="text-xs text-slate-400 mb-3">
                Upload a new resume to automatically update your profile fields.
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={profile.full_name || ''}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">Email</label>
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
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Professional Summary</label>
                <textarea
                  value={profile.summary || ''}
                  onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





