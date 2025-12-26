// Prompt construction for Resume Generator
import type {
  UserProfileDefaults,
  Template,
  GenerationRequest,
  JobType,
  Tone,
} from './types';

export interface PromptContext {
  userProfile: UserProfileDefaults;
  request: GenerationRequest;
  resumeTemplate?: Template;
  coverLetterTemplate?: Template;
}

/**
 * Builds the prompt for generating a tailored resume
 */
export function buildResumePrompt(context: PromptContext): string {
  const { userProfile, request } = context;
  const { job_description } = request;

  // Build user data section as resume text
  const userDataSection = buildUserDataSection(userProfile, request.options);

  // Build job description sections context if parsed
  const jobDescriptionSections = request.parsed_job_description?.sections || [];
  const detectedHeaders = request.parsed_job_description?.detectedHeaders || [];
  
  let jobDescriptionText = job_description;
  if (jobDescriptionSections.length > 0) {
    // Include both structured sections and full text
    jobDescriptionText = jobDescriptionSections.map(s => `${s.header}:\n${s.content}`).join('\n\n') + '\n\n' + job_description;
  }

  const prompt = `You are an expert resume strategist and ATS-optimization specialist.

  You will receive two sections:
  
  1. ***Resume***: The candidate's original resume with their true background, experience, skills, and achievements.
  2. ***Job Description***: The full text of the role they are applying to.
  
  **CRITICAL: KEYWORD AND SKILL EXTRACTION**
  
  Before generating the resume, you MUST:
  1. Extract the MOST IMPORTANT key terms, technologies, tools, skills, and methodologies mentioned in the job description.
  2. Identify specific software, platforms, certifications, and technical terms (for example: SIEM, EDR, IDS/IPS, OT/ICS, cloud platforms, scripting languages, etc.).
  3. Identify required skills and experience areas (for example: configuration, integration, workflows, analytics, troubleshooting, incident response, stakeholder communication, etc.).
  4. These keywords and skills MUST be used throughout the generated resume in:
     - The Professional Summary
     - The Core Skills & Tools section (include the most relevant tools/technologies from the JD)
     - Experience bullet points (weave in keywords naturally)
     - Role Alignment sections
  
  Your job is to generate a **tailored resume** that:
  
  - **PRIMARY**: Accurately represents the candidate's actual experience, achievements, and background from their uploaded resume.
  - **SECONDARY**: Incorporates keywords, tools, technologies, and skills from the job description to frame the candidate's experience in JD-relevant terms, where this is realistic.
  - **MANDATORY**: EVERY experience bullet point MUST tie back to the job description in one or more ways (tools, keywords, concepts, responsibilities, or required competencies). Multiple connections per bullet are encouraged where natural.
  - Keeps the candidate's facts accurate (do NOT invent degrees, certifications, or job titles that are not implied by the resume).
  - Reframes and rewrites their **actual** experience and achievements using **relevant language, skills, tools, and techniques from the job description** where it's realistically consistent with their background.
  - Mirrors the **format and section structure** specified below.
  - Uses the **job description’s terminology** when describing the candidate's experience, **but only where it realistically describes what they have actually done**.
  - **CRITICAL**: The resume should read as the candidate's authentic experience, enhanced with JD-relevant keywords. Every bullet should connect the candidate's real experience to JD requirements.
  
  You will receive input structured like this:
  
  ***Resume***
  ${userDataSection}
  
  ***Job Description***
  ${jobDescriptionText}
  
  ---
  
  ## STEP 1: UNDERSTAND BOTH SOURCES
  
  **A. Analyze the Candidate's Resume:**
  - Identify the candidate's actual experience, achievements, skills, and background.
  - Note their real accomplishments, metrics, and responsibilities.
  - Understand their domain expertise and technical capabilities.
  - This is your PRIMARY source - the resume must reflect their actual background.
  
  **B. Extract Keywords from Job Description:**
  - Extract important keywords, tools, technologies, and skills from the job description.
  - Examples: Software/platform names, technical tools, methodologies, skills/competencies, certifications, experience requirements, specific modules.
  - This is your SECONDARY source - use these to frame/describe the candidate's experience.
  
  **C. Map JD Keywords to Candidate Experience:**
  - For each key JD concept, determine if it can realistically describe the candidate's actual experience.
  - Only use JD keywords where they align with what the candidate has actually done.
  - Use JD terminology to enhance descriptions of the candidate's real achievements, not to create new ones.
  
  **BALANCE**: The resume should be roughly 70% candidate's actual experience, 30% JD-relevant framing and terminology.
  
  ---
  
  ## OUTPUT FORMAT
  
  Return the tailored resume as a **JSON object** with the following structure. The response must be valid JSON that can be parsed directly. Do not include any markdown formatting, code blocks, explanations, or text outside the JSON object.
  
  {
    "resume": {
      "profile": "Professional summary (3-5 sentences)",
      "skills": ["Skill 1", "Skill 2", "Skill 3"],
      "experience": [
        {
          "title": "Job Title",
          "company": "Company Name",
          "location": "City, State or empty string if unknown",
          "dates": "Start Date - End Date",
          "bullets": [
            "Achievement-focused bullet point 1",
            "Achievement-focused bullet point 2",
            "Achievement-focused bullet point 3",
            "Achievement-focused bullet point 4",
            "Achievement-focused bullet point 5",
            "Achievement-focused bullet point 6"
          ]
        }
      ],
      "education": [
        {
          "degree": "Degree Name",
          "institution": "Institution Name",
          "location": "City, State or empty string if unknown",
          "graduationDate": "Month Year or empty string if unknown",
          "gpa": "GPA or empty string if not provided"
        }
      ],
      "role_alignment": {
        "summary_of_duties": [
          "Bullet point showing how candidate meets summary of duties",
          "Another bullet point",
          "Another bullet point"
        ],
        "essential_functions": [
          "Bullet point showing how candidate performs essential functions",
          "Another bullet point",
          "Another bullet point"
        ],
        "minimum_qualifications": [
          "Bullet point showing candidate meets minimum qualifications",
          "Another bullet point",
          "Another bullet point"
        ]
      }
    }
  }
  
  ---
  
  ### 1. Professional Summary (profile field)
  
  - 3–5 sentences.
  - **PRIMARY FOCUS**: Start with the candidate's actual background, experience, and achievements from their resume.
  - **SECONDARY**: Incorporate 2–3 relevant keywords, technologies, or skills from the job description that align with the candidate's real experience.
  - Clearly state:
    - The candidate's background from their resume (e.g., their real experience level, domain expertise, key achievements).
    - How their actual experience aligns with the target role, using relevant JD terminology where it fits naturally.
    - 2–3 key strengths from the candidate's actual resume that map to the job description, using JD-relevant terminology when appropriate.
  - **BALANCE**: The summary should read as the candidate's authentic profile, enhanced with JD keywords, NOT as a job description rewrite.
  
  ### 2. Core Skills & Tools (skills array)
  
  - Present as an array of strings.
  - **PRIMARY (60-70%)**: Include skills, tools, and technologies that are clearly supported by the candidate's actual resume.
  - **SECONDARY (30-40%)**: Include job-specific skills/tools from the job description that are plausibly aligned with the candidate's background. Use JD terminology when it can realistically describe the candidate's experience.
  - Start with the candidate's actual skills from their resume, then add JD-relevant skills/tools where they align.
  - Do NOT list specific certifications, tools, or technologies that don't exist in the candidate's resume and aren't plausibly related to their experience.
  
  ### 3. Experience (experience array)
  
  - For each relevant role in the candidate's resume:
    - Include:
      - Job title (DO NOT change their actual job titles)
      - Organization (DO NOT change their actual employers)
      - Location (if available)
      - Dates
    - Then **4–8 bullet points per role** (target 6–10 for the most recent role, 3–6 for earlier roles) that:
      - **MANDATORY REQUIREMENT**: EVERY bullet point MUST tie back to the job description in one or more ways:
        - Reference a specific tool, technology, or platform mentioned in the JD, OR
        - Use terminology or keywords from the JD, OR
        - Relate to a responsibility, function, or requirement from the JD, OR
        - Connect to a skill or competency mentioned in the JD (e.g., proactive analysis, stakeholder communication, troubleshooting, incident response).
      - **PRIMARY**: Start with the candidate's ACTUAL achievements and responsibilities from their resume. These should be the core of each bullet.
      - Start with strong action verbs.
      - Show measurable results or impact when possible (use the candidate's real metrics and achievements).
      - **SECONDARY**: Incorporate relevant keywords, tools, technologies, or concepts from the job description to frame/describe the candidate's experience.
      - **BALANCE**: 
        - ~70% of each bullet should reflect the candidate's actual experience and achievements.
        - ~30% should use JD terminology, keywords, tools, or concepts to tie the bullet back to the job description.
      - Do NOT create bullets that are primarily JD requirements with minimal connection to the candidate's background.
  
  - DO NOT say they worked for the target company in the past if they did not.
  - DO NOT fabricate specific technologies or tools that would be clearly untrue; instead, use general but JD-aligned language (e.g., "endpoint and network telemetry", "SIEM-style analytics") when needed.
  
  ### 4. Education (education array)
  
  - List degrees and institutions from the resume.
  - You may reformat to be cleaner, but do not add degrees that do not exist.
  - If GPA or location is not provided, use an empty string.
  
  ### 5. Role Alignment (role_alignment object)
  
  Under this final section, create three subsections, each with **2–5 bullet points** that show how the candidate aligns with the job posting. These should NOT restate the job description; they should translate requirements into evidence based on the candidate's background:
  
  **summary_of_duties** (array of strings)
  - Rephrase the core responsibilities of the role into statements starting with phrases like:
    - "Proven ability to..."
    - "Demonstrated experience..."
    - "Track record of..."
  - Each bullet should connect a duty from the job description with something the candidate has done (or with a clearly defensible capability based on their resume).
  
  **essential_functions** (array of strings)
  - Map the job's "essential functions" into bullets describing how the candidate's ACTUAL experience aligns:
    - Start with what the candidate has actually done from their resume.
    - Then show how it relates to the JD's essential functions using JD terminology.
  
  **minimum_qualifications** (array of strings)
  - Present bullets that explicitly show the candidate **meets or exceeds** the minimum qualifications based on their ACTUAL background:
    - Education from the candidate's resume.
    - Years of experience based on the candidate's actual work history.
    - Experience with specific tools/technologies from the candidate's resume that align with JD requirements.
  
  ---
  
  ## IMPORTANT CONSTRAINTS
  
  - **PRIMARY RULE**: The resume must accurately represent the candidate's ACTUAL experience, achievements, and background from their uploaded resume.
  - **SECONDARY RULE**: Use job description keywords and terminology to frame/describe the candidate's real experience in JD-relevant terms, but only where it's realistic.
  - Do NOT copy sentences from the job description verbatim.
  - Do NOT invent:
    - New employers
    - New degrees
    - New job titles
    - Specific certifications that are not present
    - Experience that doesn't exist in the candidate's resume
  - The resume should read as the candidate's authentic experience enhanced with JD keywords, NOT as a job description rewritten to look like a resume.
  - Aim for:
    - 3–5 summary sentences
    - 8–15+ bullets across experience
    - 6–12 bullets across the Role Alignment subsections
  - Return ONLY the JSON object starting with { and ending with }.
  - Do not wrap in markdown code blocks.
  - Do not include any text before or after the JSON`;
  

  return prompt;
}

/**
 * Builds the prompt for generating a tailored cover letter
 */
export function buildCoverLetterPrompt(context: PromptContext): string {
  const { userProfile, request, coverLetterTemplate } = context;
  const { job_description, job_title, company_name, job_type, tone } = request;

  const candidateName = userProfile.full_name || 'Your Name';
  const candidateEmail = userProfile.email || '';

  const jobTypeInstructions = buildJobTypeInstructions(job_type);
  const toneInstructions = buildToneInstructions(tone);

  // Build job-specific context for cover letter
  const jobContext = [
    `Job Title: ${job_title}`,
    company_name ? `Company: ${company_name}` : '',
    `Job Type: ${job_type}`,
  ].filter(Boolean).join('\n');

  const prompt = `Here's a job description for a job I'm applying to. I've attached my resume. Write a compelling cover letter that makes me a top candidate for this job:

JOB INFORMATION:
${jobContext}

JOB DESCRIPTION:
${job_description}

MY INFORMATION:
- Name: ${candidateName}
${candidateEmail ? `- Email: ${candidateEmail}` : ''}
${userProfile.location ? `- Location: ${userProfile.location}` : ''}
${userProfile.summary ? `- Summary: ${userProfile.summary.substring(0, 200)}` : ''}

MY RESUME:
${buildUserDataSection(userProfile, {})}

${jobTypeInstructions}

INSTRUCTIONS:
1. Analyze the job description to understand:
   - The company's needs and the role's requirements
   - Key qualifications and skills sought
   - Company culture indicators (if mentioned)
   - The type of candidate they're looking for

2. Analyze the candidate's background to identify:
   - experiences and achievements
   - Skills
   - Quantifiable accomplishments
   - Unique value propositions
   ... and make these things relate to the job description and company culture.

3. Write a compelling cover letter that:
   - Opens with a strong, engaging introduction that shows enthusiasm
   - Clearly demonstrates understanding of the role and company
   - Highlights 2-3 key experiences or achievements that directly match the job requirements
   - Uses specific examples from the candidate's background to show why they are an ideal fit
   - Shows how the candidate's unique skills and experiences will benefit the company
   - Conveys genuine interest and passion for the role
   - Closes with a confident, professional call to action

${toneInstructions}

WRITING REQUIREMENTS:
- Professional yet personable tone
- Concise and impactful (3-4 paragraphs, approximately 300-400 words)
- Use the candidate's actual name: ${candidateName}
- Address the hiring manager professionally (use "Dear Hiring Manager" if company name cannot be determined)
- Include specific examples and achievements from the candidate's background
- Connect every point back to how it benefits the employer
- Avoid generic phrases - make it unique and memorable
- End with "Sincerely," followed by the candidate's name
${candidateEmail ? `- Include email address below the signature: ${candidateEmail}` : ''}

OUTPUT FORMAT:
You MUST return ONLY a valid JSON object with the following structure. The response must be valid JSON that can be parsed directly. Do not include any markdown formatting, code blocks, explanations, or text outside the JSON object. The JSON must start with { and end with }.

Return a JSON object with this exact structure:

{
  "cover_letter": {
    "subject": "Re: ${job_title}${company_name ? ` - ${company_name}` : ''}",
    "greeting": "Dear Hiring Manager,",
    "opening": "Opening paragraph (2-3 sentences showing enthusiasm and understanding of the role)",
    "body": [
      "Body paragraph 1 (highlighting relevant experience/achievement 1)",
      "Body paragraph 2 (highlighting relevant experience/achievement 2)",
      "Body paragraph 3 (optional - additional relevant point or closing argument)"
    ],
    "closing": "Closing paragraph expressing interest and call to action (2-3 sentences)",
    "signature": "${candidateName}${candidateEmail ? `\\n${candidateEmail}` : ''}"
  }
}

IMPORTANT:
- Return ONLY the JSON object starting with { and ending with }
- Do not wrap in markdown code blocks
- Do not include any text before or after the JSON
- The body array should contain 2-3 paragraphs
- All text should be professional and tailored to the specific job`;

  return prompt;
}

function buildUserDataSection(profile: UserProfileDefaults, options: any): string {
  let section = '';

  if (profile.full_name) section += `Name: ${profile.full_name}\n`;
  if (profile.email) section += `Email: ${profile.email}\n`;
  if (profile.phone) section += `Phone: ${profile.phone}\n`;
  if (profile.location) section += `Location: ${profile.location}\n`;
  if (profile.summary) section += `\nProfessional Summary: ${profile.summary}\n`;

  if (profile.experience && profile.experience.length > 0) {
    section += '\nWORK EXPERIENCE:\n';
    profile.experience.forEach((exp: any) => {
      section += `- ${exp.title} at ${exp.company}`;
      if (exp.location) section += ` (${exp.location})`;
      if (exp.startDate) {
        section += ` | ${exp.startDate}`;
        if (exp.endDate) section += ` - ${exp.endDate}`;
        else if (exp.current) section += ' - Present';
      }
      section += '\n';
      if (exp.bullets && Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet: string) => {
          section += `  • ${bullet}\n`;
        });
      }
      if (options.show_salary && exp.salary) {
        section += `  Salary: ${exp.salary}\n`;
      }
    });
  }

  if (profile.education && profile.education.length > 0) {
    section += '\nEDUCATION:\n';
    profile.education.forEach((edu: any) => {
      section += `- ${edu.degree} from ${edu.institution}`;
      if (edu.location) section += ` (${edu.location})`;
      if (edu.graduationDate) section += ` | ${edu.graduationDate}`;
      if (edu.gpa) section += ` | GPA: ${edu.gpa}`;
      section += '\n';
    });
  }

  if (profile.skills && profile.skills.length > 0) {
    section += '\nSKILLS:\n';
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    if (skills.length > 0) {
      if (typeof skills[0] === 'string') {
        section += skills.join(', ') + '\n';
      } else {
        section += skills.map((s: any) => s.name || s).join(', ') + '\n';
      }
    }
  }

  if (options.show_certifications && profile.certifications && profile.certifications.length > 0) {
    section += '\nCERTIFICATIONS:\n';
    profile.certifications.forEach((cert: any) => {
      section += `- ${cert.name} from ${cert.issuer || 'N/A'}`;
      if (cert.date) section += ` (${cert.date})`;
      section += '\n';
    });
  }

  if (options.show_awards && profile.awards && profile.awards.length > 0) {
    section += '\nAWARDS & RECOGNITION:\n';
    profile.awards.forEach((award: any) => {
      section += `- ${award.title}`;
      if (award.issuer) section += ` from ${award.issuer}`;
      if (award.date) section += ` (${award.date})`;
      section += '\n';
    });
  }

  if (options.show_service && profile.service && profile.service.length > 0) {
    section += '\nSERVICE / VOLUNTEER WORK:\n';
    profile.service.forEach((svc: any) => {
      section += `- ${svc.role} at ${svc.organization}`;
      if (svc.startDate) {
        section += ` | ${svc.startDate}`;
        if (svc.endDate) section += ` - ${svc.endDate}`;
        else if (svc.current) section += ' - Present';
      }
      if (svc.description) section += `\n  ${svc.description}`;
      section += '\n';
    });
  }

  if (options.show_languages && profile.languages && profile.languages.length > 0) {
    section += '\nLANGUAGES:\n';
    profile.languages.forEach((lang: any) => {
      section += `- ${lang.name}: ${lang.proficiency || 'N/A'}\n`;
    });
  }

  if (options.show_projects && profile.projects && profile.projects.length > 0) {
    section += '\nPROJECTS:\n';
    profile.projects.forEach((proj: any) => {
      section += `- ${proj.name}: ${proj.description || ''}`;
      if (proj.technologies && proj.technologies.length > 0) {
        section += ` (Technologies: ${proj.technologies.join(', ')})`;
      }
      section += '\n';
    });
  }

  return section;
}

function buildTemplateInstructions(template: Template | undefined, options: any): string {
  if (!template) {
    return 'FORMAT: Use a clean, professional format with standard sections.';
  }

  const config = template.layout_config || {};
  const sections = config.sections || ['header', 'summary', 'experience', 'education', 'skills'];

  return `TEMPLATE REQUIREMENTS:
- Follow the "${template.name}" template format
- Section order: ${sections.join(' → ')}
- Font: ${config.font || 'Arial'}
- Font size: ${config.fontSize || 11}pt
- Maintain consistent formatting throughout`;
}

function buildJobTypeInstructions(jobType: JobType): string {
  const instructions: Record<JobType, string> = {
    private_sector: 'JOB TYPE: Private Sector\n- Focus on achievements, metrics, and business impact\n- Emphasize innovation, efficiency, and results\n- Use modern, dynamic language\n- Highlight leadership and collaboration skills',
    federal_government: 'JOB TYPE: Federal Government\n- Use USAJobs-compatible format\n- Emphasize specific qualifications and competencies\n- Include relevant certifications and clearances\n- Use formal, professional language\n- Highlight public service and mission alignment',
    internship: 'JOB TYPE: Internship / Entry-Level\n- Emphasize education, coursework, and projects\n- Highlight relevant skills and willingness to learn\n- Show enthusiasm and potential\n- Include any relevant volunteer work or extracurricular activities',
    apprenticeship: 'JOB TYPE: Apprenticeship\n- Emphasize hands-on experience and technical skills\n- Highlight relevant training and certifications\n- Show commitment to learning and growth\n- Include any relevant work experience or projects',
  };

  return instructions[jobType] || instructions.private_sector;
}

function buildToneInstructions(tone: Tone): string {
  const instructions: Record<Tone, string> = {
    professional: 'TONE: Professional and polished. Use formal language while remaining approachable.',
    federal: 'TONE: Formal and authoritative. Use government-appropriate language and terminology.',
    private: 'TONE: Professional and results-oriented. Emphasize business value and achievements.',
    internship: 'TONE: Enthusiastic and eager. Show willingness to learn and contribute.',
    friendly: 'TONE: Warm and personable. Maintain professionalism while showing personality.',
    confident: 'TONE: Assertive and self-assured. Highlight strengths and achievements confidently.',
    executive: 'TONE: Strategic and leadership-focused. Emphasize vision, impact, and results.',
  };

  return instructions[tone] || instructions.professional;
}

function buildVisibilityInstructions(options: any): string {
  const instructions: string[] = [];

  if (!options.show_awards) {
    instructions.push('- Do NOT include Awards & Recognition section');
  }
  if (!options.show_service) {
    instructions.push('- Do NOT include Service/Volunteer section');
  }
  if (!options.show_languages) {
    instructions.push('- Do NOT include Languages section');
  }
  if (!options.show_certifications) {
    instructions.push('- Do NOT include Certifications section');
  }
  if (!options.show_projects) {
    instructions.push('- Do NOT include Projects section');
  }
  if (options.show_salary && (options.former_salary || options.desired_salary)) {
    instructions.push('- Include salary information if relevant to the position');
  } else {
    instructions.push('- Do NOT include any salary information');
  }

  if (instructions.length === 0) {
    return '';
  }

  return 'SECTION VISIBILITY:\n' + instructions.join('\n');
}

function buildLengthInstructions(length?: string): string {
  if (length === '1-page') {
    return 'LENGTH: Keep the resume concise to fit on one page. Prioritize the most relevant and impactful information.';
  } else if (length === '2-page') {
    return 'LENGTH: Resume can span up to two pages. Include comprehensive information while maintaining clarity and relevance.';
  }
  return 'LENGTH: Aim for 1-2 pages. Prioritize relevance and impact.';
}


