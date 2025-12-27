import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/resume/auth';
import OpenAI from 'openai';
import {
  getUserProfileDefaults,
  getTemplate,
  ensureUserHasCredits,
  consumeCredits,
  createGeneration,
} from '@/lib/resume/db';
import { buildResumePrompt, buildCoverLetterPrompt } from '@/lib/resume/prompts';
import { generateResumeDocx, generateCoverLetterDocx } from '@/lib/resume/docx';
import type {
  GenerationRequest,
  GeneratedResumeContent,
  GeneratedCoverLetterContent,
} from '@/lib/resume/types';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate tailored resume and cover letter using the new structured system
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let requestBody: any;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    // Try to get user ID from request body first (passed from client)
    let userId: string | undefined = requestBody.userId;

    // If not in body, try to get from auth
    if (!userId) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    // Extract generation request (without userId)
    const generationRequest: GenerationRequest = {
      job_title: requestBody.job_title,
      company_name: requestBody.company_name,
      job_type: requestBody.job_type,
      tone: requestBody.tone,
      job_description: requestBody.job_description,
      resume_template_id: requestBody.resume_template_id,
      cover_letter_template_id: requestBody.cover_letter_template_id,
      options: requestBody.options || {},
    };

    // Validate required fields
    if (!generationRequest.job_title || !generationRequest.job_description) {
      return NextResponse.json(
        { error: 'Job title and job description are required' },
        { status: 400 }
      );
    }

    // Check credits
    const hasCredits = await ensureUserHasCredits(userId, 1);
    if (!hasCredits) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits to continue.' },
        { status: 402 }
      );
    }

    // Get user profile defaults
    const userProfile = await getUserProfileDefaults(userId);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Please complete your profile setup first' },
        { status: 400 }
      );
    }

    // Get templates
    const resumeTemplate = generationRequest.resume_template_id
      ? await getTemplate(generationRequest.resume_template_id)
      : undefined;
    const coverLetterTemplate = generationRequest.cover_letter_template_id
      ? await getTemplate(generationRequest.cover_letter_template_id)
      : undefined;

    // Build prompts
    const resumePrompt = buildResumePrompt({
      userProfile,
      request: generationRequest,
      resumeTemplate: resumeTemplate || undefined,
      coverLetterTemplate: coverLetterTemplate || undefined,
    });

    const coverLetterPrompt = buildCoverLetterPrompt({
      userProfile,
      request: generationRequest,
      resumeTemplate: resumeTemplate || undefined,
      coverLetterTemplate: coverLetterTemplate || undefined,
    });

    // Generate resume
    const openai = getOpenAIClient();
    const resumeResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume strategist and ATS-optimization specialist. You create detailed, tailored resumes that deeply align candidates with job descriptions while maintaining accuracy. Always return valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: resumePrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8000, // Increased to allow for deeper, more detailed output
      response_format: { type: 'json_object' },
    });

    // Generate cover letter
    const coverLetterResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert cover letter writer specializing in creating personalized, compelling cover letters. Always return valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: coverLetterPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    // Parse responses
    let resumeContent: GeneratedResumeContent;
    let coverLetterContent: GeneratedCoverLetterContent;

    try {
      const resumeJson = JSON.parse(resumeResponse.choices[0]?.message?.content || '{}');
      resumeContent = resumeJson.resume || resumeJson;

      const coverLetterJson = JSON.parse(coverLetterResponse.choices[0]?.message?.content || '{}');
      coverLetterContent = coverLetterJson.cover_letter || coverLetterJson;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fallback: try to extract JSON from markdown code blocks
      const resumeText = resumeResponse.choices[0]?.message?.content || '';
      const coverLetterText = coverLetterResponse.choices[0]?.message?.content || '';

      try {
        const resumeMatch = resumeText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || resumeText.match(/(\{[\s\S]*\})/);
        const coverLetterMatch = coverLetterText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || coverLetterText.match(/(\{[\s\S]*\})/);

        if (resumeMatch) {
          resumeContent = JSON.parse(resumeMatch[1]).resume || JSON.parse(resumeMatch[1]);
        } else {
          throw new Error('Could not parse resume JSON');
        }

        if (coverLetterMatch) {
          coverLetterContent = JSON.parse(coverLetterMatch[1]).cover_letter || JSON.parse(coverLetterMatch[1]);
        } else {
          throw new Error('Could not parse cover letter JSON');
        }
      } catch (fallbackError) {
        console.error('Fallback parsing also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to parse AI response. Please try again.' },
          { status: 500 }
        );
      }
    }

    // Generate DOCX files
    const resumeDocxBuffer = await generateResumeDocx(resumeContent, resumeTemplate || undefined, userProfile);
    const coverLetterDocxBuffer = await generateCoverLetterDocx(
      coverLetterContent,
      coverLetterTemplate || undefined
    );

    // For now, we'll store the buffers as base64 in the database
    // In production, you'd upload to object storage (S3, Supabase Storage, etc.)
    const resumeDocxBase64 = resumeDocxBuffer.toString('base64');
    const coverLetterDocxBase64 = coverLetterDocxBuffer.toString('base64');

    // Calculate tokens used (approximate)
    const tokensUsed =
      (resumeResponse.usage?.total_tokens || 0) + (coverLetterResponse.usage?.total_tokens || 0);

    // Consume credits
    await consumeCredits(userId, 1);

    // Create generation record
    const generation = await createGeneration({
      user_id: userId,
      job_title: generationRequest.job_title,
      company_name: generationRequest.company_name,
      job_type: generationRequest.job_type,
      resume_template_id: generationRequest.resume_template_id,
      cover_letter_template_id: generationRequest.cover_letter_template_id,
      tone: generationRequest.tone,
      options: generationRequest.options || {},
      job_description: generationRequest.job_description,
      generated_resume_markdown: JSON.stringify(resumeContent),
      generated_cover_letter_markdown: JSON.stringify(coverLetterContent),
      resume_docx_url: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${resumeDocxBase64}`,
      cover_letter_docx_url: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${coverLetterDocxBase64}`,
      tokens_used: tokensUsed,
    });

    // Return response
    return NextResponse.json({
      success: true,
      generation_id: generation.id,
      resume: resumeContent,
      cover_letter: coverLetterContent,
      resume_docx_base64: resumeDocxBase64,
      cover_letter_docx_base64: coverLetterDocxBase64,
      tokens_used: tokensUsed,
    });
  } catch (error) {
    console.error('Resume generation error:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}




