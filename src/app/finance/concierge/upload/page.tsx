'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadStatementPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [accountId, setAccountId] = useState<string>('');
    const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [userConsent, setUserConsent] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            // Load accounts - you'll need to implement this API route or use existing
            const response = await fetch('/api/finance/accounts'); // Adjust based on your API
            if (response.ok) {
                const data = await response.json();
                setAccounts(data.accounts || []);
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file || !userConsent) {
            setError('Please select a file and provide consent');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (accountId) {
                formData.append('account_id', accountId);
            }
            formData.append('user_consent', 'true');

            const response = await fetch('/api/financial-concierge/upload-statement', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to upload statement');
            }

            setSuccess(`File uploaded successfully. Statement file ID: ${data.statement_file_id}`);
            
            // Optionally process immediately
            setTimeout(() => {
                router.push(`/finance/concierge/process/${data.statement_file_id}`);
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Upload Statement</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Select Statement File (PDF or CSV)
                    </label>
                    <input
                        type="file"
                        accept=".pdf,.csv"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                        required
                    />
                    {file && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Account (Optional)
                    </label>
                    <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                        <option value="">Select an account (optional)</option>
                        {accounts.map(account => (
                            <option key={account.id} value={account.id}>
                                {account.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={userConsent}
                            onChange={(e) => setUserConsent(e.target.checked)}
                            className="mt-1 w-5 h-5 text-amber-500"
                            required
                        />
                        <div className="text-sm">
                            <strong>Consent to Process Statement</strong>
                            <p className="mt-1 text-slate-600 dark:text-slate-400">
                                I consent to upload and process my financial statement. 
                                My data will be stored securely and used only for financial analysis.
                            </p>
                        </div>
                    </label>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
                        {success}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !file || !userConsent}
                    className="w-full px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50"
                >
                    {loading ? 'Uploading...' : 'Upload Statement'}
                </button>
            </form>
        </div>
    );
}

