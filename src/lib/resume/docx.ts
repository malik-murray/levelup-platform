// DOCX generation utilities for Resume Generator
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, SectionType } from 'docx';
import type {
  GeneratedResumeContent,
  GeneratedCoverLetterContent,
  Template,
} from './types';

/**
 * Generate a DOCX file for a resume
 */
export async function generateResumeDocx(
  content: GeneratedResumeContent,
  template?: Template,
  userProfile?: { full_name?: string; email?: string; phone?: string; location?: string } | null
): Promise<Buffer> {
  const config = template?.layout_config || {};
  const font = config.font || 'Arial';
  const fontSize = config.fontSize || 11;

  const children: Paragraph[] = [];

  // Personal Information Header
  if (userProfile) {
    const headerParts: string[] = [];
    if (userProfile.full_name) headerParts.push(userProfile.full_name);
    if (userProfile.email) headerParts.push(userProfile.email);
    if (userProfile.phone) headerParts.push(userProfile.phone);
    if (userProfile.location) headerParts.push(userProfile.location);
    
    if (headerParts.length > 0) {
      children.push(
        new Paragraph({
          text: headerParts.join(' | '),
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );
      // Add a separator line
      children.push(
        new Paragraph({
          text: '─'.repeat(80),
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }
  } else if (content.profile) {
    // Fallback: Extract name from profile if available
    const nameMatch = content.profile.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (nameMatch) {
      children.push(
        new Paragraph({
          text: nameMatch[1],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    }
  }

  // Professional Summary / Profile
  if (content.profile) {
    children.push(
      new Paragraph({
        text: 'Professional Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        text: content.profile,
        spacing: { after: 200 },
      })
    );
  }

  // Experience
  if (content.experience && content.experience.length > 0) {
    children.push(
      new Paragraph({
        text: 'Professional Experience',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.experience.forEach((exp) => {
      // Job title and company
      const titleCompany = `${exp.title}${exp.company ? ` | ${exp.company}` : ''}${exp.location ? `, ${exp.location}` : ''}`;
      children.push(
        new Paragraph({
          text: titleCompany,
          spacing: { before: 100, after: 50 },
        })
      );

      // Dates
      if (exp.dates) {
        children.push(
          new Paragraph({
            text: exp.dates,
            spacing: { after: 50 },
          })
        );
      }

      // Bullet points
      exp.bullets.forEach((bullet) => {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: {
              level: 0,
            },
            spacing: { after: 50 },
          })
        );
      });
    });
  }

  // Education
  if (content.education && content.education.length > 0) {
    children.push(
      new Paragraph({
        text: 'Education',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.education.forEach((edu) => {
      const eduText = `${edu.degree}${edu.institution ? `, ${edu.institution}` : ''}${edu.location ? `, ${edu.location}` : ''}${edu.graduationDate ? ` | ${edu.graduationDate}` : ''}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`;
      children.push(
        new Paragraph({
          text: eduText,
          spacing: { after: 100 },
        })
      );
    });
  }

  // Core Skills & Tools
  if (content.skills && content.skills.length > 0) {
    children.push(
      new Paragraph({
        text: 'Core Skills & Tools',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        text: content.skills.join(', '),
        spacing: { after: 200 },
      })
    );
  }

  // Certifications
  if (content.certifications && content.certifications.length > 0) {
    children.push(
      new Paragraph({
        text: 'Certifications',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.certifications.forEach((cert) => {
      const certText = `${cert.name}${cert.issuer ? `, ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}`;
      children.push(
        new Paragraph({
          text: certText,
          spacing: { after: 100 },
        })
      );
    });
  }

  // Projects
  if (content.projects && content.projects.length > 0) {
    children.push(
      new Paragraph({
        text: 'Projects',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.projects.forEach((proj) => {
      children.push(
        new Paragraph({
          text: proj.name,
          spacing: { before: 100, after: 50 },
        })
      );
      children.push(
        new Paragraph({
          text: proj.description,
          spacing: { after: 50 },
        })
      );
      if (proj.technologies && proj.technologies.length > 0) {
        children.push(
          new Paragraph({
            text: `Technologies: ${proj.technologies.join(', ')}`,
            spacing: { after: 100 },
          })
        );
      }
    });
  }

  // Awards
  if (content.awards && content.awards.length > 0) {
    children.push(
      new Paragraph({
        text: 'Awards & Recognition',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.awards.forEach((award) => {
      const awardText = `${award.title}${award.issuer ? `, ${award.issuer}` : ''}${award.date ? ` (${award.date})` : ''}`;
      children.push(
        new Paragraph({
          text: awardText,
          spacing: { after: 100 },
        })
      );
    });
  }

  // Service / Volunteer
  if (content.service && content.service.length > 0) {
    children.push(
      new Paragraph({
        text: 'Service & Volunteer Work',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    content.service.forEach((svc) => {
      const svcText = `${svc.role} at ${svc.organization}${svc.dates ? ` | ${svc.dates}` : ''}`;
      children.push(
        new Paragraph({
          text: svcText,
          spacing: { after: 50 },
        })
      );
      if (svc.description) {
        children.push(
          new Paragraph({
            text: svc.description,
            spacing: { after: 100 },
          })
        );
      }
    });
  }

  // Languages
  if (content.languages && content.languages.length > 0) {
    children.push(
      new Paragraph({
        text: 'Languages',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    const langText = content.languages.map((lang) => `${lang.name} (${lang.proficiency})`).join(', ');
    children.push(
      new Paragraph({
        text: langText,
        spacing: { after: 200 },
      })
    );
  }

  // Role Alignment section (new format)
  if (content.role_alignment) {
    children.push(
      new Paragraph({
        text: 'Role Alignment',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );

    if (content.role_alignment.summary_of_duties && content.role_alignment.summary_of_duties.length > 0) {
      children.push(
        new Paragraph({
          text: content.role_alignment.summary_of_duties_header || 'Summary of Duties',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 },
        })
      );
      content.role_alignment.summary_of_duties.forEach((bullet) => {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: {
              level: 0,
            },
            spacing: { after: 50 },
          })
        );
      });
    }

    if (content.role_alignment.essential_functions && content.role_alignment.essential_functions.length > 0) {
      children.push(
        new Paragraph({
          text: content.role_alignment.essential_functions_header || 'Essential Functions',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 },
        })
      );
      content.role_alignment.essential_functions.forEach((bullet) => {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: {
              level: 0,
            },
            spacing: { after: 50 },
          })
        );
      });
    }

    if (content.role_alignment.minimum_qualifications && content.role_alignment.minimum_qualifications.length > 0) {
      children.push(
        new Paragraph({
          text: content.role_alignment.minimum_qualifications_header || 'Minimum Qualifications',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 50 },
        })
      );
      content.role_alignment.minimum_qualifications.forEach((bullet) => {
        children.push(
          new Paragraph({
            text: bullet,
            bullet: {
              level: 0,
            },
            spacing: { after: 50 },
          })
        );
      });
    }
  }

  // Custom sections (from job description format - legacy support)
  if (content.custom_sections && content.custom_sections.length > 0) {
    content.custom_sections.forEach((section) => {
      children.push(
        new Paragraph({
          text: section.header,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );
      children.push(
        new Paragraph({
          text: section.content,
          spacing: { after: 200 },
        })
      );
    });
  }

  // Salary section (if provided)
  if (content.salary_section) {
    children.push(
      new Paragraph({
        text: 'Salary Information',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      })
    );
    children.push(
      new Paragraph({
        text: content.salary_section,
        spacing: { after: 200 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: font,
            size: fontSize * 2, // docx uses half-points
          },
        },
      },
    },
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate DOCX from formatted plain text
 * Used when regenerating DOCX from edited formatted text
 */
export async function generateDocxFromText(text: string): Promise<Buffer> {
  const lines = text.split('\n');
  const paragraphs: Paragraph[] = [];
  let skipNext = false;
  let isFirstLine = true;

  for (let i = 0; i < lines.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      // Empty line - add spacing
      paragraphs.push(
        new Paragraph({
          text: '',
          spacing: { after: 100 },
        })
      );
      continue;
    }

    // Check if it's a separator line
    if (trimmed.match(/^[═─]+$/)) {
      // If it's the first separator after what looks like a header (personal info), center it
      if (isFirstLine || (i > 0 && lines[i - 1].includes('|'))) {
        paragraphs.push(
          new Paragraph({
            text: '─'.repeat(80),
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          })
        );
      }
      continue;
    }

    // Check if it's the personal info header (contains | separators and contact info)
    if (isFirstLine && trimmed.includes('|') && (trimmed.includes('@') || trimmed.match(/\d{3}/))) {
      paragraphs.push(
        new Paragraph({
          text: trimmed,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );
      isFirstLine = false;
      continue;
    }

    isFirstLine = false;

    // Check if it's a header (all caps and reasonable length)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 60 && !trimmed.includes('•') && !trimmed.includes('|')) {
      // Check if next line is a separator
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      if (nextLine.match(/^[═─]+$/)) {
        paragraphs.push(
          new Paragraph({
            text: trimmed,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        skipNext = true; // Skip the separator line
        continue;
      } else if (trimmed.length < 50) {
        // Likely a header
        paragraphs.push(
          new Paragraph({
            text: trimmed,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        continue;
      }
    }

    // Check if it's a bullet point
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      const bulletText = trimmed.substring(1).trim();
      paragraphs.push(
        new Paragraph({
          text: bulletText,
          bullet: {
            level: 0,
          },
          spacing: { after: 50 },
        })
      );
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        text: trimmed,
        spacing: { after: 100 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Generate a DOCX file for a cover letter
 */
export async function generateCoverLetterDocx(
  content: GeneratedCoverLetterContent,
  template?: Template
): Promise<Buffer> {
  const config = template?.layout_config || {};
  const font = config.font || 'Arial';
  const fontSize = config.fontSize || 11;
  const paragraphSpacing = config.paragraphSpacing || 1.15;

  const children: Paragraph[] = [];

  // Subject line (if provided)
  if (content.subject) {
    children.push(
      new Paragraph({
        text: content.subject,
        spacing: { after: 200 },
      })
    );
  }

  // Greeting
  children.push(
    new Paragraph({
      text: content.greeting,
      spacing: { before: 200, after: 200 },
    })
  );

  // Opening paragraph
  children.push(
    new Paragraph({
      text: content.opening,
      spacing: { after: Math.round(200 * paragraphSpacing) },
    })
  );

  // Body paragraphs
  content.body.forEach((paragraph) => {
    children.push(
      new Paragraph({
        text: paragraph,
        spacing: { after: Math.round(200 * paragraphSpacing) },
      })
    );
  });

  // Closing paragraph
  children.push(
    new Paragraph({
      text: content.closing,
      spacing: { after: Math.round(200 * paragraphSpacing) },
    })
  );

  // Signature
  children.push(
    new Paragraph({
      text: content.signature,
      spacing: { before: 400, after: 200 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: font,
            size: fontSize * 2, // docx uses half-points
          },
        },
      },
    },
  });

  return await Packer.toBuffer(doc);
}


