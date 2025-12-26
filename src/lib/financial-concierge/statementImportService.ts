/**
 * StatementImportService - Handles statement file uploads and processing
 * Stores files securely in private storage, metadata only in DB
 */

import { createClient } from '@supabase/supabase-js';
import { parsePdfTransactions, ParsedTransaction } from '@/lib/pdfParser';
import { StatementFile, StatementFileStatus, StatementPeriod } from './types';
import { FinancialAuditLog, AuditActionType } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_STORAGE_BUCKET = 'statement-files'; // Private storage bucket

export interface StatementUploadResult {
    success: boolean;
    statement_file_id: string | null;
    file_name: string;
    error?: string;
}

export interface StatementProcessResult {
    success: boolean;
    transactions_imported: number;
    statement_period_id: string | null;
    errors?: string[];
}

/**
 * Parses CSV statement file
 * Basic CSV parser - can be enhanced based on bank format
 */
function parseCsvTransactions(csvText: string): ParsedTransaction[] {
    const lines = csvText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        return [];
    }

    // Assume first line is header
    const header = lines[0].toLowerCase();
    const dateIndex = header.indexOf('date');
    const descriptionIndex = header.indexOf('description') !== -1 ? header.indexOf('description') : 
                            header.indexOf('memo') !== -1 ? header.indexOf('memo') : 
                            header.indexOf('payee') !== -1 ? header.indexOf('payee') : 0;
    const amountIndex = header.indexOf('amount');

    if (dateIndex === -1 || amountIndex === -1) {
        throw new Error('CSV must contain Date and Amount columns');
    }

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length < Math.max(dateIndex, descriptionIndex, amountIndex) + 1) {
            continue;
        }

        const dateStr = values[dateIndex];
        const description = values[descriptionIndex] || '';
        const amountStr = values[amountIndex];

        // Parse date (handle various formats)
        let date: string;
        try {
            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) {
                // Try MM/DD/YYYY or DD/MM/YYYY
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                } else {
                    continue; // Skip invalid date
                }
            } else {
                date = dateObj.toISOString().split('T')[0];
            }
        } catch {
            continue; // Skip invalid date
        }

        // Parse amount
        const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount)) {
            continue; // Skip invalid amount
        }

        transactions.push({
            rawLine: line,
            date,
            description,
            amount: -Math.abs(amount), // Default to expense (negative)
        });
    }

    return transactions;
}

/**
 * Uploads statement file to secure storage
 */
export async function uploadStatementFile(
    userId: string,
    file: File,
    accountId: string | null,
    userConsent: boolean
): Promise<StatementUploadResult> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    try {
        // Validate file type
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const fileType = fileExtension === 'pdf' ? 'pdf' : fileExtension === 'csv' ? 'csv' : null;

        if (!fileType) {
            return {
                success: false,
                statement_file_id: null,
                file_name: file.name,
                error: 'File must be PDF or CSV',
            };
        }

        if (!userConsent) {
            return {
                success: false,
                statement_file_id: null,
                file_name: file.name,
                error: 'User consent required for statement upload',
            };
        }

        // Create storage path: user_id/filename_timestamp.ext
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${userId}/${timestamp}_${sanitizedFileName}`;

        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage (private bucket)
        // Note: Ensure the bucket exists and has proper RLS policies
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .upload(storagePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return {
                success: false,
                statement_file_id: null,
                file_name: file.name,
                error: `Failed to upload file: ${uploadError.message}`,
            };
        }

        // Create statement_file record
        const { data: statementFile, error: dbError } = await supabase
            .from('statement_files')
            .insert({
                user_id: userId,
                file_name: file.name,
                file_type: fileType,
                file_size_bytes: file.size,
                storage_path: storagePath,
                account_id: accountId,
                status: 'uploaded',
                user_consent_given: userConsent,
                consent_given_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (dbError) {
            // Rollback: delete uploaded file
            await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([storagePath]);
            throw dbError;
        }

        // Log audit event
        await supabase.from('financial_audit_log').insert({
            user_id: userId,
            action_type: 'statement_upload',
            action_details: {
                file_name: file.name,
                file_type: fileType,
                file_size_bytes: file.size,
            },
            resource_type: 'statement_file',
            resource_id: statementFile.id,
        });

        return {
            success: true,
            statement_file_id: statementFile.id,
            file_name: file.name,
        };
    } catch (error) {
        console.error('Error uploading statement file:', error);
        return {
            success: false,
            statement_file_id: null,
            file_name: file.name,
            error: error instanceof Error ? error.message : 'Failed to upload statement file',
        };
    }
}

/**
 * Processes a statement file (parses and imports transactions)
 */
export async function processStatementFile(
    userId: string,
    statementFileId: string,
    accountId: string
): Promise<StatementProcessResult> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    try {
        // Get statement file record
        const { data: statementFile, error: fileError } = await supabase
            .from('statement_files')
            .select('*')
            .eq('id', statementFileId)
            .eq('user_id', userId)
            .single();

        if (fileError || !statementFile) {
            throw new Error('Statement file not found');
        }

        // Update status to processing
        await supabase
            .from('statement_files')
            .update({ status: 'processing' })
            .eq('id', statementFileId);

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(SUPABASE_STORAGE_BUCKET)
            .download(statementFile.storage_path);

        if (downloadError || !fileData) {
            throw new Error(`Failed to download file: ${downloadError?.message}`);
        }

        // Parse transactions based on file type
        let parsedTransactions: ParsedTransaction[] = [];
        
        if (statementFile.file_type === 'pdf') {
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            parsedTransactions = await parsePdfTransactions(buffer);
        } else if (statementFile.file_type === 'csv') {
            const text = await fileData.text();
            parsedTransactions = parseCsvTransactions(text);
        } else {
            throw new Error(`Unsupported file type: ${statementFile.file_type}`);
        }

        if (parsedTransactions.length === 0) {
            throw new Error('No transactions found in statement file');
        }

        // Extract statement period from transactions
        const dates = parsedTransactions.map(tx => tx.date).sort();
        const periodStartDate = dates[0];
        const periodEndDate = dates[dates.length - 1];

        // Create or update statement period
        let statementPeriodId: string | null = null;
        const { data: existingPeriod } = await supabase
            .from('statement_periods')
            .select('id')
            .eq('user_id', userId)
            .eq('account_id', accountId)
            .eq('period_start_date', periodStartDate)
            .eq('period_end_date', periodEndDate)
            .single();

        if (existingPeriod) {
            statementPeriodId = existingPeriod.id;
        } else {
            const { data: newPeriod, error: periodError } = await supabase
                .from('statement_periods')
                .insert({
                    user_id: userId,
                    account_id: accountId,
                    period_start_date: periodStartDate,
                    period_end_date: periodEndDate,
                    statement_file_id: statementFileId,
                    reconciled: false,
                })
                .select()
                .single();

            if (periodError) {
                throw new Error(`Failed to create statement period: ${periodError.message}`);
            }
            statementPeriodId = newPeriod.id;
        }

        // Import transactions
        let transactionsImported = 0;
        const errors: string[] = [];

        // Transform parsed transactions to database format
        const transactionsToInsert = parsedTransactions.map(tx => ({
            date: tx.date,
            amount: tx.amount, // Already negative for expenses
            name: tx.description.substring(0, 255), // Truncate if too long
            person: 'System',
            note: tx.description.length > 255 ? tx.description.substring(255) : null,
            account_id: accountId,
            category_id: null, // Will be categorized later
            user_id: userId,
            statement_file_id: statementFileId,
            statement_period_id: statementPeriodId,
        }));

        // Insert transactions in batches
        const batchSize = 100;
        for (let i = 0; i < transactionsToInsert.length; i += batchSize) {
            const batch = transactionsToInsert.slice(i, i + batchSize);
            const { error: insertError } = await supabase
                .from('transactions')
                .insert(batch);

            if (insertError) {
                errors.push(`Batch ${i / batchSize + 1}: ${insertError.message}`);
            } else {
                transactionsImported += batch.length;
            }
        }

        // Update statement file status
        const finalStatus: StatementFileStatus = errors.length > 0 ? 'error' : 'processed';
        await supabase
            .from('statement_files')
            .update({
                status: finalStatus,
                processed_at: new Date().toISOString(),
                period_start_date: periodStartDate,
                period_end_date: periodEndDate,
                error_message: errors.length > 0 ? errors.join('; ') : null,
            })
            .eq('id', statementFileId);

        // Log audit event
        await supabase.from('financial_audit_log').insert({
            user_id: userId,
            action_type: 'statement_process',
            action_details: {
                statement_file_id: statementFileId,
                transactions_imported: transactionsImported,
                errors_count: errors.length,
            },
            resource_type: 'statement_file',
            resource_id: statementFileId,
        });

        return {
            success: errors.length === 0,
            transactions_imported: transactionsImported,
            statement_period_id: statementPeriodId,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        // Update status to error
        await supabase
            .from('statement_files')
            .update({
                status: 'error',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', statementFileId);

        console.error('Error processing statement file:', error);
        return {
            success: false,
            transactions_imported: 0,
            statement_period_id: null,
            errors: [error instanceof Error ? error.message : 'Failed to process statement file'],
        };
    }
}

/**
 * Gets statement files for a user
 */
export async function getStatementFiles(userId: string): Promise<StatementFile[]> {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    const { data, error } = await supabase
        .from('statement_files')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

    if (error) {
        throw error;
    }

    return (data || []) as StatementFile[];
}


