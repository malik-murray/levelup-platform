import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

/**
 * Parse resume text into structured data using OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeText } = body;

    if (!resumeText || !resumeText.trim()) {
      return NextResponse.json(
        { error: 'Resume text is required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    const prompt = `You are an expert at parsing resumes. Extract structured information from the following resume text and return it as JSON.

RESUME TEXT:
${resumeText}

Extract the following information and return it as a JSON object with this exact structure:
{
  "full_name": "Full name of the person",
  "email": "Email address if found",
  "phone": "Phone number if found",
  "location": "City, State or location if found",
  "summary": "Professional summary or objective if found",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "title": "Job title",
      "company": "Company name",
      "location": "Location if mentioned",
      "startDate": "Start date (Month Year format)",
      "endDate": "End date or 'Present' if current",
      "current": true or false,
      "bullets": ["Achievement 1", "Achievement 2", "Achievement 3"]
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "School/University name",
      "location": "Location if mentioned",
      "graduationDate": "Graduation date (Month Year format)",
      "gpa": "GPA if mentioned"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "Date if mentioned"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description",
      "technologies": ["tech1", "tech2"]
    }
  ],
  "languages": [
    {
      "name": "Language name",
      "proficiency": "Native/Fluent/Conversational/Basic"
    }
  ],
  "awards": [
    {
      "title": "Award title",
      "issuer": "Issuing organization if mentioned",
      "date": "Date if mentioned"
    }
  ],
  "service": [
    {
      "organization": "Organization name",
      "role": "Role or position",
      "startDate": "Start date",
      "endDate": "End date or 'Present'",
      "current": true or false,
      "description": "Description if available"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting
- If a field is not found, use null or empty array/string as appropriate
- Extract dates in "Month Year" format (e.g., "January 2020")
- For current positions, set "current": true and "endDate": "Present"
- Extract all skills, even if they're in different sections
- Be thorough in extracting experience bullets and achievements`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at parsing and extracting structured data from resumes. Always return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown if needed
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse OpenAI response as JSON');
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error('Structured parse error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to parse resume',
      },
      { status: 500 }
    );
  }
}










