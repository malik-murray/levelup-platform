'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../logo.png';
import { ThemeToggle } from '@/components/ThemeToggle';

type Profile = {
    name: string;
    headline: string;
    summary: string;
    email: string;
    phone: string;
    location: string;
};

type GeneratedResume = {
    resume: string;
    coverLetter: string;
    extractedKeywords: string[];
};

const PROFILE_STORAGE_KEY = 'resume_generator_profile';
const RESUME_STORAGE_KEY = 'resume_generator_resume';
const RESUME_FILENAME_STORAGE_KEY = 'resume_generator_resume_filename';

export default function ResumePage() {
    // Load profile from localStorage on mount
    const [profile, setProfile] = useState<Profile>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error('Failed to parse saved profile:', e);
                }
            }
        }
        return {
            name: '',
            headline: '',
            summary: '',
            email: '',
            phone: '',
            location: '',
        };
    });

    const [jobDescription, setJobDescription] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    
    // Load resume text and filename from localStorage on mount
    const [resumeText, setResumeText] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(RESUME_STORAGE_KEY) || '';
        }
        return '';
    });
    
    const [resumeFileName, setResumeFileName] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(RESUME_FILENAME_STORAGE_KEY) || '';
        }
        return '';
    });
    const [uploading, setUploading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [generatedContent, setGeneratedContent] = useState<GeneratedResume | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setNotification(null);
        setResumeFile(file);
        setResumeFileName(file.name);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/resume/parse', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.error || 'Failed to parse resume';
                const suggestion = data.suggestion ? ` ${data.suggestion}` : '';
                throw new Error(errorMsg + suggestion);
            }

            setResumeText(data.resumeText);
            setResumeFileName(file.name);
            // Save to localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem(RESUME_STORAGE_KEY, data.resumeText);
                localStorage.setItem(RESUME_FILENAME_STORAGE_KEY, file.name);
            }
            setNotification(`Resume uploaded successfully! Extracted ${data.resumeText.length} characters.`);
        } catch (error) {
            console.error('Error uploading resume:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to upload resume');
            setResumeFile(null);
            setResumeFileName('');
            // Clear localStorage on error
            if (typeof window !== 'undefined') {
                localStorage.removeItem(RESUME_STORAGE_KEY);
                localStorage.removeItem(RESUME_FILENAME_STORAGE_KEY);
            }
        } finally {
            setUploading(false);
        }
    };

    const handleGenerateResume = async () => {
        if (!jobDescription.trim()) {
            setNotification('Please paste a job description.');
            return;
        }

        if (!resumeText.trim()) {
            setNotification('Please upload your generic resume first.');
            return;
        }

        setGenerating(true);
        setNotification(null);

        try {
            const response = await fetch('/api/resume/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resumeText,
                    jobDescription,
                    profile,
                }),
            });

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                let errorMessage = 'Failed to generate resume';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Parse JSON response
            let data;
            try {
                const text = await response.text();
                if (!text) {
                    throw new Error('Empty response from server');
                }
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('JSON parsing error:', parseError);
                throw new Error('Invalid response from server. Please try again.');
            }

            if (!data || !data.resume || !data.coverLetter) {
                throw new Error('Invalid response format from server');
            }

            setGeneratedContent(data);
            setNotification('Resume and cover letter generated successfully!');
        } catch (error) {
            console.error('Error generating resume:', error);
            setNotification(error instanceof Error ? error.message : 'Failed to generate resume');
        } finally {
            setGenerating(false);
        }
    };

    // Save profile to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
        }
    }, [profile]);

    // Save resume text and filename to localStorage whenever they change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (resumeText) {
                localStorage.setItem(RESUME_STORAGE_KEY, resumeText);
            } else {
                localStorage.removeItem(RESUME_STORAGE_KEY);
            }
            if (resumeFileName) {
                localStorage.setItem(RESUME_FILENAME_STORAGE_KEY, resumeFileName);
            } else {
                localStorage.removeItem(RESUME_FILENAME_STORAGE_KEY);
            }
        }
    }, [resumeText, resumeFileName]);

    const handleProfileChange = (field: keyof Profile, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const isProfileComplete = profile.name.trim() !== '' && profile.headline.trim() !== '' && profile.summary.trim() !== '';

    return (
        <main className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-white transition-colors">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-black transition-colors">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative h-8 w-8">
                            <Image src={logo} alt="LevelUpSolutions logo" className="h-full w-full object-contain" fill />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-amber-400">Resume Generator</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Upload resume + job description → Tailored resume & cover letter</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                        >
                            ← Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">
                {/* Profile Status */}
                <div className={`rounded-lg border p-6 ${isProfileComplete ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-amber-500/30 bg-amber-950/20'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold mb-1">Profile Status</h2>
                            <p className="text-sm text-slate-400">
                                {isProfileComplete ? 'Profile complete ✓' : 'Profile incomplete - Complete basic info to generate resumes'}
                            </p>
                        </div>
                        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${isProfileComplete ? 'bg-emerald-400 text-black' : 'bg-amber-400 text-black'}`}>
                            {isProfileComplete ? 'Complete' : 'Incomplete'}
                        </div>
                    </div>
                </div>

                {/* Profile Form */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Full Name *</label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={e => handleProfileChange('name', e.target.value)}
                                placeholder="John Doe"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Headline *</label>
                            <input
                                type="text"
                                value={profile.headline}
                                onChange={e => handleProfileChange('headline', e.target.value)}
                                placeholder="Senior Software Engineer"
                                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Professional Summary *</label>
                            <textarea
                                value={profile.summary}
                                onChange={e => handleProfileChange('summary', e.target.value)}
                                placeholder="A brief summary of your experience and expertise..."
                                className="w-full h-32 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    onChange={e => handleProfileChange('email', e.target.value)}
                                    placeholder="john@example.com"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Phone</label>
                                <input
                                    type="tel"
                                    value={profile.phone}
                                    onChange={e => handleProfileChange('phone', e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={profile.location}
                                    onChange={e => handleProfileChange('location', e.target.value)}
                                    placeholder="San Francisco, CA"
                                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {notification && (
                    <div className={`rounded-lg border p-3 text-xs ${
                        notification.includes('Error') || notification.includes('Failed')
                            ? 'border-red-500/30 bg-red-950/20 text-red-400'
                            : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
                    }`}>
                        {notification}
                    </div>
                )}

                {/* Upload Resume Section */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Upload Your Generic Resume</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">
                                Resume File (PDF, DOC, DOCX, or TXT)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="block w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-400 file:text-black hover:file:bg-amber-300 file:cursor-pointer cursor-pointer disabled:opacity-50"
                                />
                            </div>
                            {uploading && (
                                <p className="text-xs text-amber-400 mt-2">Uploading and parsing resume...</p>
                            )}
                            {resumeFileName && (
                                <p className="text-xs text-emerald-400 mt-2">
                                    ✓ {resumeFileName} uploaded successfully
                                    {resumeText && ` (${resumeText.length} characters extracted)`}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">
                                Upload your generic resume (PDF or DOCX recommended). We'll extract your skills and experiences to tailor it to each job.
                            </p>
                            <p className="text-xs text-slate-500 mt-1 italic">
                                Note: Older .doc files are not supported. Please convert to DOCX or PDF format.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Job Description Input */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <h2 className="text-lg font-semibold mb-4">Job Description</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">
                                Paste Job Description *
                            </label>
                            <textarea
                                value={jobDescription}
                                onChange={e => setJobDescription(e.target.value)}
                                placeholder="Paste the full job description here. Include requirements, responsibilities, and preferred qualifications..."
                                className="w-full h-64 rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Our AI will extract keywords and requirements to tailor your resume.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Generate Button */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                    <button
                        onClick={handleGenerateResume}
                        disabled={!resumeText.trim() || !jobDescription.trim() || generating}
                        className="w-full rounded-md bg-amber-400 px-4 py-3 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {generating ? 'Generating Resume & Cover Letter...' : 'Generate Tailored Resume & Cover Letter'}
                    </button>
                    <p className="text-xs text-slate-400 text-center mt-3">
                        AI will combine keywords from the job description with your resume's skills and experiences to create a tailored resume and cover letter that makes you a top candidate.
                    </p>
                </div>

                {/* Generated Content Display */}
                {generatedContent && (
                    <div className="space-y-6">
                        {/* Generated Resume */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Generated Tailored Resume</h2>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([generatedContent.resume], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'tailored-resume.txt';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    Download
                                </button>
                            </div>
                            <div className="rounded-md border border-slate-800 bg-slate-900 p-4 max-h-96 overflow-y-auto">
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                                    {generatedContent.resume}
                                </pre>
                            </div>
                        </div>

                        {/* Generated Cover Letter */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Generated Cover Letter</h2>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([generatedContent.coverLetter], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'cover-letter.txt';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                                >
                                    Download
                                </button>
                            </div>
                            <div className="rounded-md border border-slate-800 bg-slate-900 p-4 max-h-96 overflow-y-auto">
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
                                    {generatedContent.coverLetter}
                                </pre>
                            </div>
                        </div>

                        {/* Extracted Keywords */}
                        {generatedContent.extractedKeywords && generatedContent.extractedKeywords.length > 0 && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950 p-6">
                                <h3 className="text-sm font-semibold mb-3">Extracted Keywords from Job Description</h3>
                                <div className="flex flex-wrap gap-2">
                                    {generatedContent.extractedKeywords.map((keyword, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded-full bg-amber-900/30 border border-amber-500/30 px-3 py-1 text-xs text-amber-300"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
