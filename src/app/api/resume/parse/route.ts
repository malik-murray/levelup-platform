import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Parse resume file (PDF, DOCX, DOC, or text) to extract resume content
 * This endpoint extracts text from uploaded resume files for AI processing
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type - check both MIME type and file extension
        const allowedMimeTypes = [
            'application/pdf',
            'text/plain',
            'application/msword', // DOC files
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // DOCX files
        ];
        
        const fileName = file.name.toLowerCase();
        const isDocx = fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isDoc = fileName.endsWith('.doc') || file.type === 'application/msword';
        const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';
        const isTxt = fileName.endsWith('.txt') || file.type === 'text/plain';

        if (!isPdf && !isTxt && !isDocx && !isDoc) {
            return NextResponse.json(
                { error: 'File must be a PDF, DOC, DOCX, or TXT file' },
                { status: 400 }
            );
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let resumeText = '';

        // Parse based on file type
        if (isPdf) {
            try {
                const pdfData = await pdfParse(buffer);
                resumeText = pdfData.text;
            } catch (parseError) {
                console.error('PDF parsing error:', parseError);
                return NextResponse.json(
                    { error: 'Failed to parse PDF file. Please ensure the PDF is not encrypted or corrupted.' },
                    { status: 400 }
                );
            }
        } else if (isTxt) {
            // Plain text file
            resumeText = buffer.toString('utf-8');
        } else if (isDocx) {
            // DOCX file - use mammoth to extract text
            try {
                const result = await mammoth.extractRawText({ buffer });
                resumeText = result.value;
                
                // Log any warnings from mammoth
                if (result.messages && result.messages.length > 0) {
                    console.warn('DOCX parsing warnings:', result.messages);
                }
            } catch (parseError) {
                console.error('DOCX parsing error:', parseError);
                return NextResponse.json(
                    { error: 'Failed to parse DOCX file. Please ensure the file is not corrupted or try converting to PDF.' },
                    { status: 400 }
                );
            }
        } else if (isDoc) {
            // Older .doc format - not well supported, provide helpful error
            return NextResponse.json(
                { 
                    error: 'Older .doc files are not fully supported. Please convert your resume to DOCX or PDF format. You can open it in Microsoft Word and save as DOCX or PDF.',
                    suggestion: 'Try saving your resume as a DOCX or PDF file and upload again.'
                },
                { status: 400 }
            );
        }

        if (!resumeText || resumeText.trim().length === 0) {
            return NextResponse.json(
                { error: 'No text content found in the resume file' },
                { status: 400 }
            );
        }

        // Return parsed resume text
        return NextResponse.json({
            success: true,
            resumeText: resumeText.trim(),
            fileName: file.name,
            fileSize: file.size,
        });
    } catch (error) {
        console.error('Resume parse error:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to parse resume file' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

