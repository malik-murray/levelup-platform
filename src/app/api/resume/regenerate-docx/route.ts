import { NextRequest, NextResponse } from 'next/server';
import { generateResumeDocx, generateCoverLetterDocx, generateDocxFromText } from '@/lib/resume/docx';
import { getTemplate, updateGeneration } from '@/lib/resume/db';
import { getAuthenticatedUser } from '@/lib/resume/auth';
import type {
  GeneratedResumeContent,
  GeneratedCoverLetterContent,
  UserProfileDefaults,
} from '@/lib/resume/types';

// Parse formatted text back into structured cover letter content
function parseCoverLetterFromText(text: string, originalCoverLetter: GeneratedCoverLetterContent): GeneratedCoverLetterContent {
  // Simple parsing: split by double newlines for paragraphs
  const lines = text.split('\n');
  let subject = '';
  let greeting = '';
  let opening = '';
  const body: string[] = [];
  let closing = '';
  let signature = '';

  let currentSection = 'greeting';
  let currentParagraph = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect subject
    if (line.startsWith('Subject:')) {
      subject = line.replace('Subject:', '').trim();
      continue;
    }

    // Detect greeting (usually first line after subject)
    if (currentSection === 'greeting' && line && !line.includes('Subject:')) {
      greeting = line;
      currentSection = 'opening';
      continue;
    }

    // Detect opening (first paragraph after greeting)
    if (currentSection === 'opening') {
      if (line) {
        opening += (opening ? ' ' : '') + line;
      } else if (opening) {
        currentSection = 'body';
        continue;
      }
    }

    // Detect body paragraphs
    if (currentSection === 'body') {
      if (line) {
        currentParagraph += (currentParagraph ? ' ' : '') + line;
      } else if (currentParagraph) {
        body.push(currentParagraph);
        currentParagraph = '';
        // Check if next non-empty line is closing
        const nextNonEmpty = lines.slice(i + 1).find(l => l.trim());
        if (nextNonEmpty && (nextNonEmpty.includes('Sincerely') || nextNonEmpty.includes('Best regards') || nextNonEmpty.includes('Thank you'))) {
          currentSection = 'closing';
        }
      }
    }

    // Detect closing
    if (currentSection === 'closing') {
      if (line && !line.match(/^[A-Z][a-z]+\s+[A-Z]/)) { // Not a name (signature)
        closing += (closing ? ' ' : '') + line;
      } else if (line) {
        signature = line;
        break;
      }
    }
  }

  // If we still have a current paragraph, add it
  if (currentParagraph && currentSection === 'body') {
    body.push(currentParagraph);
  }

  // If no body paragraphs were found, try to extract from opening
  if (body.length === 0 && opening) {
    const openingParts = opening.split(/\n\n+/);
    if (openingParts.length > 1) {
      opening = openingParts[0];
      body.push(...openingParts.slice(1));
    }
  }

  return {
    subject: subject || originalCoverLetter.subject,
    greeting: greeting || originalCoverLetter.greeting,
    opening: opening || originalCoverLetter.opening,
    body: body.length > 0 ? body : originalCoverLetter.body,
    closing: closing || originalCoverLetter.closing,
    signature: signature || originalCoverLetter.signature,
  };
}

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { 
      generation_id,
      userId: requestUserId,
      resume, 
      cover_letter, 
      resume_formatted_text, 
      cover_letter_formatted_text, 
      user_profile,
      resume_template_id,
      cover_letter_template_id
    } = requestBody;

    if (!resume && !cover_letter) {
      return NextResponse.json(
        { error: 'Either resume or cover_letter content is required' },
        { status: 400 }
      );
    }

    // Get user ID - try from request body first (passed from client), then from auth
    let userId: string | undefined = requestUserId;
    
    // If userId not in body and generation_id is provided, try to get from auth
    if (!userId && generation_id) {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    let resumeDocxBase64: string | undefined;
    let coverLetterDocxBase64: string | undefined;

    // Get templates if IDs provided
    const resumeTemplate = resume_template_id ? await getTemplate(resume_template_id) : undefined;
    const coverLetterTemplate = cover_letter_template_id ? await getTemplate(cover_letter_template_id) : undefined;

    if (resume) {
      // If formatted text was provided, use it directly to generate DOCX
      if (resume_formatted_text) {
        const resumeDocxBuffer = await generateDocxFromText(resume_formatted_text);
        resumeDocxBase64 = resumeDocxBuffer.toString('base64');
      } else {
        // Use structured content with user profile for header and template
        const resumeDocxBuffer = await generateResumeDocx(
          resume as GeneratedResumeContent,
          resumeTemplate || undefined,
          user_profile as UserProfileDefaults | null
        );
        resumeDocxBase64 = resumeDocxBuffer.toString('base64');
      }
    }

    if (cover_letter) {
      // If formatted text was provided, use it directly to generate DOCX
      if (cover_letter_formatted_text) {
        const coverLetterDocxBuffer = await generateDocxFromText(cover_letter_formatted_text);
        coverLetterDocxBase64 = coverLetterDocxBuffer.toString('base64');
      } else {
        // Use structured content with template
        const coverLetterDocxBuffer = await generateCoverLetterDocx(
          cover_letter as GeneratedCoverLetterContent,
          coverLetterTemplate || undefined
        );
        coverLetterDocxBase64 = coverLetterDocxBuffer.toString('base64');
      }
    }

    // Update the generation record in the archive if generation_id is provided
    if (generation_id && userId) {
      const updates: any = {};
      
      // Update resume if provided
      if (resume) {
        if (resume_formatted_text) {
          // Store the formatted text as the markdown (it's the edited version)
          updates.generated_resume_markdown = resume_formatted_text;
        } else {
          // Store structured JSON
          updates.generated_resume_markdown = JSON.stringify(resume);
        }
        if (resumeDocxBase64) {
          updates.resume_docx_url = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${resumeDocxBase64}`;
        }
      }
      
      // Update cover letter if provided
      if (cover_letter) {
        if (cover_letter_formatted_text) {
          // Store the formatted text as the markdown (it's the edited version)
          updates.generated_cover_letter_markdown = cover_letter_formatted_text;
        } else {
          // Store structured JSON
          updates.generated_cover_letter_markdown = JSON.stringify(cover_letter);
        }
        if (coverLetterDocxBase64) {
          updates.cover_letter_docx_url = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${coverLetterDocxBase64}`;
        }
      }
      
      // Update the generation record
      await updateGeneration(generation_id, userId, updates);
    }

    return NextResponse.json({
      success: true,
      resume_docx_base64: resumeDocxBase64,
      cover_letter_docx_base64: coverLetterDocxBase64,
    });
  } catch (error) {
    console.error('DOCX regeneration error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to regenerate DOCX',
      },
      { status: 500 }
    );
  }
}


