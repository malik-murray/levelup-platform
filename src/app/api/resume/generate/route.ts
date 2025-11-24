import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client lazily to avoid errors if API key is not set
function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key is not configured');
    }
    return new OpenAI({ apiKey });
}

/**
 * Generate tailored resume and cover letter from generic resume + job description
 * Uses ChatGPT to analyze the resume and job description, then generates
 * a tailored resume and cover letter that makes the applicant a top candidate
 */
export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }

        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        if (!body.resumeText || !body.jobDescription) {
            return NextResponse.json(
                { error: 'Resume text and job description are required' },
                { status: 400 }
            );
        }

        const { resumeText, jobDescription, profile } = body;

        // Validate OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.' },
                { status: 500 }
            );
        }

        // Extract keywords from job description for display purposes
        const jdKeywords = extractKeywords(jobDescription);

        // Generate tailored resume using ChatGPT
        const tailoredResume = await generateTailoredResume(resumeText, jobDescription, profile);

        // Generate tailored cover letter using ChatGPT
        const coverLetter = await generateTailoredCoverLetter(resumeText, jobDescription, profile);

        return NextResponse.json({
            success: true,
            resume: tailoredResume,
            coverLetter: coverLetter,
            extractedKeywords: jdKeywords,
        });
    } catch (error) {
        console.error('Resume generation error:', error);

        // Handle OpenAI API errors
        if (error && typeof error === 'object' && 'status' in error) {
            const apiError = error as { status?: number; message?: string };
            return NextResponse.json(
                { 
                    error: apiError.message || 'OpenAI API error',
                    details: apiError.status ? `Status: ${apiError.status}` : undefined
                },
                { status: 500 }
            );
        }

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Failed to generate resume' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

/**
 * Generate a tailored resume using ChatGPT
 * Analyzes the job description and rewrites the resume to highlight relevant experiences
 */
async function generateTailoredResume(
    resumeText: string,
    jobDescription: string,
    profile?: { name?: string; headline?: string; email?: string; phone?: string; location?: string }
): Promise<string> {
    const profileInfo = profile ? `
Candidate Information:
- Name: ${profile.name || 'Not provided'}
- Headline: ${profile.headline || 'Not provided'}
- Email: ${profile.email || 'Not provided'}
- Phone: ${profile.phone || 'Not provided'}
- Location: ${profile.location || 'Not provided'}
` : '';

    const prompt = `You are an expert resume writer and career advisor. Your task is to create a tailored, professional resume that makes the candidate a top candidate for the position.

JOB DESCRIPTION:
${jobDescription}

${profileInfo}

CANDIDATE'S CURRENT RESUME:
${resumeText}

INSTRUCTIONS:
1. Analyze the job description to identify key requirements, skills, qualifications, and responsibilities.
2. Review the candidate's resume to identify relevant experiences, skills, and achievements.
3. Rewrite and tailor the resume to:
   - Highlight experiences and achievements that directly match the job requirements
   - Reorder and prioritize sections to emphasize the most relevant qualifications first
   - Rewrite bullet points to use keywords from the job description naturally
   - Quantify achievements where possible (numbers, percentages, metrics)
   - Ensure the resume emphasizes skills and experiences that make the candidate an ideal fit
   - Keep the resume professional, clear, and ATS-friendly
   - Maintain accuracy - do not make up experiences or qualifications

FORMAT REQUIREMENTS:
- Use a clean, professional format
- Include all sections: Header (with name, contact info if provided), Professional Summary/Objective, Work Experience, Education, Skills
- Use bullet points for achievements and responsibilities
- Keep the resume concise but comprehensive (typically 1-2 pages worth of content)
- Use action verbs and strong language
- Include specific accomplishments with metrics when possible

OUTPUT FORMAT:
Return ONLY the tailored resume text, formatted clearly with sections and bullet points. Do not include any explanations or additional commentary.`;

    try {
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert resume writer specializing in tailoring resumes to specific job descriptions. You create compelling, professional resumes that help candidates stand out.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 4000,
        });

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error('Invalid response from OpenAI API');
        }

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('Empty response from OpenAI API');
        }

        return content;
    } catch (apiError) {
        console.error('OpenAI API error in resume generation:', apiError);
        if (apiError instanceof Error) {
            throw new Error(`Failed to generate resume: ${apiError.message}`);
        }
        throw new Error('Failed to generate resume: Unknown error from OpenAI API');
    }
}

/**
 * Generate a tailored cover letter using ChatGPT
 * Creates a compelling cover letter that connects the candidate's experience to the job requirements
 */
async function generateTailoredCoverLetter(
    resumeText: string,
    jobDescription: string,
    profile?: { name?: string; headline?: string; email?: string; phone?: string; location?: string }
): Promise<string> {
    const candidateName = profile?.name || 'Your Name';
    const candidateEmail = profile?.email || '';

    const prompt = `You are an expert cover letter writer. Your task is to create a compelling, personalized cover letter that makes the candidate a top candidate for the position.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE'S RESUME:
${resumeText}

CANDIDATE INFORMATION:
- Name: ${candidateName}
${profile?.headline ? `- Professional Headline: ${profile.headline}` : ''}
${candidateEmail ? `- Email: ${candidateEmail}` : ''}

INSTRUCTIONS:
1. Analyze the job description to understand:
   - The company's needs and the role's requirements
   - Key qualifications and skills sought
   - Company culture indicators (if mentioned)
   - The type of candidate they're looking for

2. Analyze the candidate's resume to identify:
   - Most relevant experiences and achievements
   - Skills that match the job requirements
   - Quantifiable accomplishments
   - Unique value propositions

3. Write a compelling cover letter that:
   - Opens with a strong, engaging introduction that shows enthusiasm
   - Clearly demonstrates understanding of the role and company
   - Highlights 2-3 key experiences or achievements that directly match the job requirements
   - Uses specific examples from the resume to show why the candidate is an ideal fit
   - Shows how the candidate's unique skills and experiences will benefit the company
   - Conveys genuine interest and passion for the role
   - Closes with a confident, professional call to action

WRITING REQUIREMENTS:
- Professional yet personable tone
- Concise and impactful (3-4 paragraphs, approximately 300-400 words)
- Use the candidate's actual name: ${candidateName}
- Address the hiring manager professionally (use "Dear Hiring Manager" if company name cannot be determined)
- Include specific examples and achievements from the resume
- Connect every point back to how it benefits the employer
- Avoid generic phrases - make it unique and memorable
- End with "Sincerely," followed by the candidate's name
${candidateEmail ? `- Include email address below the signature: ${candidateEmail}` : ''}

OUTPUT FORMAT:
Return ONLY the complete cover letter text, formatted properly with paragraphs, salutation, body paragraphs, closing, and signature. Do not include any explanations or commentary.`;

    try {
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert cover letter writer specializing in creating personalized, compelling cover letters that help candidates stand out and secure interviews.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.8,
            max_tokens: 2000,
        });

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error('Invalid response from OpenAI API');
        }

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('Empty response from OpenAI API');
        }

        return content;
    } catch (apiError) {
        console.error('OpenAI API error in cover letter generation:', apiError);
        if (apiError instanceof Error) {
            throw new Error(`Failed to generate cover letter: ${apiError.message}`);
        }
        throw new Error('Failed to generate cover letter: Unknown error from OpenAI API');
    }
}

/**
 * Extract keywords from job description
 * TODO: Improve with better NLP/keyword extraction
 */
function extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words
    const commonWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
        'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));

    // Count word frequency and return top keywords
    const wordCounts = new Map<string, number>();
    words.forEach(word => {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    return Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(entry => entry[0]);
}


