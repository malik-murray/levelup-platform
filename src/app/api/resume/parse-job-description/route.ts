import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client lazily (only when needed, not at module load)
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    // Use OpenAI to extract section headers and structure
    const prompt = `You are analyzing a job description. Extract all section headers and their content.

Job Description:
${jobDescription}

Return a JSON object with this structure:
{
  "sections": [
    {
      "header": "SECTION NAME",
      "content": "Full content of this section"
    }
  ],
  "detectedHeaders": ["HEADER 1", "HEADER 2", ...]
}

Include ALL sections you find, such as:
- SUMMARY OF DUTIES
- ESSENTIAL FUNCTIONS
- MINIMUM QUALIFICATIONS
- PREFERRED QUALIFICATIONS
- WORK ENVIRONMENT
- COMMUNICATIONS AND INTERPERSONAL SKILLS
- Any other section headers you find

The "detectedHeaders" array should list just the header names in the order they appear.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a job description parser. Extract section headers and organize content. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    console.error('Error parsing job description:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to parse job description',
      },
      { status: 500 }
    );
  }
}










