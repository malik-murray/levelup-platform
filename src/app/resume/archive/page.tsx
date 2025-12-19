'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@auth/supabaseClient';
import type { Generation } from '@/lib/resume/types';

// Helper to get user ID from client-side Supabase
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export default function ArchivePage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);

  useEffect(() => {
    loadGenerations();
  }, []);

  async function loadGenerations() {
    try {
      setLoading(true);
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error('You must be logged in to view archive');
      }
      
      const response = await fetch(`/api/resume/generations?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load generations');
      }
      const data = await response.json();
      setGenerations(data.generations || []);
    } catch (error) {
      console.error('Error loading generations:', error);
    } finally {
      setLoading(false);
    }
  }

  function downloadDocx(url: string, filename: string) {
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    }
  }

  if (loading) {
    return (
      <div className="lg:ml-64 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:ml-64 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Archive</h1>

        {generations.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-12 text-center">
            <p className="text-slate-400">No generations yet. Create your first resume to get started!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Job Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Company</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Job Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((gen) => (
                  <tr key={gen.id} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-sm text-slate-200">{gen.job_title}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{gen.company_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {gen.job_type?.replace('_', ' ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {gen.created_at ? new Date(gen.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {gen.resume_docx_url && (
                          <button
                            onClick={() => downloadDocx(gen.resume_docx_url!, `${gen.job_title}_resume.docx`)}
                            className="px-3 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                          >
                            Resume
                          </button>
                        )}
                        {gen.cover_letter_docx_url && (
                          <button
                            onClick={() =>
                              downloadDocx(gen.cover_letter_docx_url!, `${gen.job_title}_cover_letter.docx`)
                            }
                            className="px-3 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                          >
                            Cover Letter
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedGeneration(gen)}
                          className="px-3 py-1 rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Preview Modal */}
        {selectedGeneration && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">{selectedGeneration.job_title}</h2>
                  <button
                    onClick={() => setSelectedGeneration(null)}
                    className="px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-4">
                  {selectedGeneration.generated_resume_markdown && (
                    <div>
                      <h3 className="font-semibold mb-2">Resume</h3>
                      <pre className="text-xs text-slate-300 bg-slate-900 p-4 rounded overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedGeneration.generated_resume_markdown), null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedGeneration.generated_cover_letter_markdown && (
                    <div>
                      <h3 className="font-semibold mb-2">Cover Letter</h3>
                      <pre className="text-xs text-slate-300 bg-slate-900 p-4 rounded overflow-x-auto">
                        {JSON.stringify(JSON.parse(selectedGeneration.generated_cover_letter_markdown), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

