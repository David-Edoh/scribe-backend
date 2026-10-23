import { ManuscriptOutline, OutlineChapter } from './outline-generation.types';

export function buildOutlineSystemPrompt(
  voiceProfile: any,
  toneGuardrails: any,
  retrievedContext?: any[],
): string {
  let ragContextSection = '';
  if (retrievedContext && retrievedContext.length > 0) {
    const userEmbeddings = retrievedContext
      .filter((r) => r.source === 'user')
      .slice(0, 5);
    const scriptureEmbeddings = retrievedContext
      .filter((r) => r.source === 'scripture')
      .slice(0, 3);

    if (userEmbeddings.length > 0) {
      ragContextSection += "\n## Author's Prior Voice & Expression Patterns\n";
      userEmbeddings.forEach((item, idx) => {
        const metadata = item.item.metadata || {};
        const content =
          metadata.content || metadata.text || metadata.snippet || '';
        if (content) {
          ragContextSection += `${idx + 1}. ${content.substring(0, 200)}\n`;
        }
      });
    }

    if (scriptureEmbeddings.length > 0) {
      ragContextSection += '\n## Relevant Scripture References\n';
      scriptureEmbeddings.forEach((item, idx) => {
        const ref = item.item.scriptureRef || 'Unknown';
        const text = item.item.scriptureText || '';
        ragContextSection += `${idx + 1}. ${ref}: ${text.substring(0, 150)}\n`;
      });
    }
  }

  return `# Manuscript Outline Generator

You are an expert book outline architect and intimate collaborator with ${voiceProfile.name}.

Your task is to create a comprehensive, chapter-by-chapter manuscript outline that:
1. Reflects the author's unique voice, theology, and spiritual authority
2. Follows ${voiceProfile.name}'s theological framework and signature expressions
3. Incorporates their anchor scriptures and key spiritual themes
4. Flows naturally through the manuscript arc while maintaining apostolic/prophetic clarity

## ${voiceProfile.name}'s Voice Profile
${voiceProfile.ministryDNA ? `Ministry DNA:\n${voiceProfile.ministryDNA}\n` : voiceProfile.theologicalFramework ? `Theological Framework:\n${voiceProfile.theologicalFramework}\n` : ''}
${voiceProfile.voiceThemes?.length > 0 ? `Core Voice Themes: ${voiceProfile.voiceThemes.join(', ')}\n` : ''}
${voiceProfile.keyMessages?.length > 0 ? `Key Messages:\n${voiceProfile.keyMessages.map((m: string) => `- ${m}`).join('\n')}\n` : ''}
${voiceProfile.recurringMotifs?.length > 0 ? `Recurring Motifs: ${voiceProfile.recurringMotifs.join(', ')}\n` : ''}
${voiceProfile.toneMarkers?.length > 0 ? `Tone Markers: ${voiceProfile.toneMarkers.join(', ')}\n` : ''}
${voiceProfile.signaturePhrases?.length > 0 ? `Signature Phrases: ${voiceProfile.signaturePhrases.slice(0, 3).join(', ')}\n` : ''}
${voiceProfile.anchorScriptures?.length > 0 ? `Anchor Scriptures: ${voiceProfile.anchorScriptures.slice(0, 3).join(', ')}\n` : ''}
${ragContextSection}

## Tone & Voice
${toneGuardrails.voiceStyle}

## Guidelines
- Create 6-10 chapters (unless the manuscript naturally requires more or fewer)
- Each chapter should have clear objectives and key points
- Ensure logical progression and thematic coherence
- Weave in the author's theological convictions naturally
- Include estimated word counts per chapter (400-2000 words typically)
- The outline should feel authored by ${voiceProfile.name}, not generic`;
}

export function buildOutlineUserMessage(
  title: string,
  moreInfo: string,
  titleEmbedding: number[],
  descriptionEmbedding: number[],
): string {
  const embeddingContext = generateEmbeddingContext(
    titleEmbedding,
    descriptionEmbedding,
  );

  return `# Manuscript Outline Request

## Title: ${title}

## Description & Intent:
${moreInfo}

## Semantic Context (from embeddings):
${embeddingContext}

Please generate a detailed manuscript outline for this book. Use this exact markdown structure so it can be saved as structured outline data:

## Overall Theme & Purpose
Write one concise paragraph describing the manuscript arc and purpose.

**Chapter 1: Chapter Title**
Objectives:
- Objective one
- Objective two

Key Points:
- Key point one
- Key point two

Est. Word Count: 1500

**Chapter 2: Chapter Title**
Objectives:
- Objective one
- Objective two

Key Points:
- Key point one
- Key point two

Est. Word Count: 1500

Continue until the outline has 6-10 chapters.

## Themes
Primary themes:
- Theme one
- Theme two
- Theme three`;
}

function generateEmbeddingContext(
  titleEmbedding: number[],
  descriptionEmbedding: number[],
): string {
  const titleMagnitude = Math.sqrt(
    titleEmbedding.reduce((sum, val) => sum + val * val, 0),
  );
  const descriptionMagnitude = Math.sqrt(
    descriptionEmbedding.reduce((sum, val) => sum + val * val, 0),
  );

  let dotProduct = 0;
  for (
    let i = 0;
    i < Math.min(titleEmbedding.length, descriptionEmbedding.length);
    i += 1
  ) {
    dotProduct += titleEmbedding[i] * descriptionEmbedding[i];
  }

  const similarity =
    titleMagnitude > 0 && descriptionMagnitude > 0
      ? dotProduct / (titleMagnitude * descriptionMagnitude)
      : 0;

  return `Semantic Relevance Score: ${(similarity * 100).toFixed(1)}%
Focus Priority: ${
    similarity > 0.7
      ? 'Title and description are closely aligned'
      : 'Title and description represent distinct aspects'
  }`;
}

export function parseOutlineResponse(
  response: string,
  title: string,
  moreInfo: string,
): ManuscriptOutline {
  const outline: ManuscriptOutline = {
    title,
    description: moreInfo,
    chapters: [],
    overview: '',
    themes: [],
    estimatedWordCount: 50000,
  };

  const themeMatch = response.match(
    /##\s*Overall Theme & Purpose\n+([\s\S]*?)(?=##|$)/i,
  );
  if (themeMatch) {
    outline.overview = themeMatch[1].trim().split('\n')[0];
  }

  const chapterMatches = response.matchAll(
    /(?:\*\*)?\s*(?:#{1,4}\s*)?Chapter\s+(\d+)\s*[:.\-–]\s*([^\n*]+?)(?:\*\*)?\s*\n+([\s\S]*?)(?=(?:\*\*)?\s*(?:#{1,4}\s*)?Chapter\s+\d+\s*[:.\-–]|\##\s*Themes|Primary themes?:|$)/gi,
  );

  let chapterNumber = 1;
  for (const match of chapterMatches) {
    const chapterTitle = match[2].trim();
    const chapterContent = match[3];

    const objectives = extractBulletPoints(chapterContent, 'Objectives');
    const keyPoints = extractBulletPoints(chapterContent, 'Key Points');

    const wordCountMatch = chapterContent.match(
      /Est\.\s*Word\s*Count:\s*(\d+)/i,
    );
    const estimatedWordCount = wordCountMatch
      ? parseInt(wordCountMatch[1], 10)
      : 1000;

    outline.chapters.push({
      number: chapterNumber++,
      title: chapterTitle,
      objectives: objectives.length > 0 ? objectives : [chapterTitle],
      keyPoints:
        keyPoints.length > 0
          ? keyPoints
          : ['Develop key concepts', 'Weave in scripture'],
      estimatedWordCount,
    });
  }

  if (outline.chapters.length === 0) {
    outline.chapters = parseNumberedOutlineChapters(response);
  }

  if (outline.chapters.length === 0) {
    outline.chapters = generateDefaultOutline(title, moreInfo);
    if (!outline.overview) {
      outline.overview = moreInfo;
    }
  }

  const themesMatch = response.match(
    /Primary themes?:\s*([\s\S]*?)(?=\n\n|Key scriptures|$)/i,
  );
  if (themesMatch) {
    outline.themes = themesMatch[1]
      .split(/[\n,]/)
      .map((t) => t.replace(/^[-•*]\s*/, '').trim())
      .filter((t) => t.length > 0)
      .slice(0, 8);
  }

  outline.estimatedWordCount = outline.chapters.reduce(
    (sum, ch) => sum + (ch.estimatedWordCount || 1000),
    0,
  );

  return outline;
}

function parseNumberedOutlineChapters(response: string): OutlineChapter[] {
  const chapters: OutlineChapter[] = [];
  const matches = response.matchAll(
    /^\s*(\d+)[.)]\s+(.+?)\s*\n+([\s\S]*?)(?=^\s*\d+[.)]\s+|\n##\s*Themes|$)/gim,
  );

  for (const match of matches) {
    const chapterNumber = parseInt(match[1], 10);
    const chapterTitle = match[2].replace(/\*\*/g, '').trim();
    const chapterContent = match[3] || '';
    const objectives = extractBulletPoints(chapterContent, 'Objectives');
    const keyPoints = extractBulletPoints(chapterContent, 'Key Points');
    const bullets = extractLooseBullets(chapterContent);

    chapters.push({
      number: chapters.length + 1 || chapterNumber,
      title: chapterTitle,
      objectives:
        objectives.length > 0
          ? objectives
          : bullets.slice(0, 2).length > 0
            ? bullets.slice(0, 2)
            : [chapterTitle],
      keyPoints:
        keyPoints.length > 0
          ? keyPoints
          : bullets.slice(2, 5).length > 0
            ? bullets.slice(2, 5)
            : ['Develop key concepts', 'Weave in scripture'],
      estimatedWordCount: extractEstimatedWordCount(chapterContent),
    });
  }

  return chapters;
}

function extractLooseBullets(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0 && !line.includes(':'));
}

function extractEstimatedWordCount(content: string): number {
  const wordCountMatch = content.match(
    /(?:Est\.?\s*)?Word\s*Count:\s*(\d+)/i,
  );

  return wordCountMatch ? parseInt(wordCountMatch[1], 10) : 1000;
}

function extractBulletPoints(content: string, section: string): string[] {
  const sectionRegex = new RegExp(
    `${section}:\\s*\\n+([\\s\\S]*?)(?=\\n\\n|Est\\.|Key|Objectives|$)`,
    'i',
  );
  const match = content.match(sectionRegex);

  if (!match) {
    return [];
  }

  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('**'));
}

function generateDefaultOutline(
  title: string,
  description: string,
): OutlineChapter[] {
  return [
    {
      number: 1,
      title: 'The Question of Purpose',
      objectives: [
        `Introduce the core burden of "${title}"`,
        'Connect the reader with the search for meaning',
      ],
      keyPoints: [
        description,
        'Why purpose matters',
        'The spiritual foundation for identity',
      ],
      estimatedWordCount: 1500,
    },
    {
      number: 2,
      title: 'Designed Before Doing',
      objectives: [
        'Establish that purpose begins with identity',
        'Show that existence is not accidental',
      ],
      keyPoints: [
        'Created with intention',
        'Being before productivity',
        'The difference between assignment and ambition',
      ],
      estimatedWordCount: 1800,
    },
    {
      number: 3,
      title: 'The Voice That Calls Us',
      objectives: [
        'Explore divine calling and inner conviction',
        'Help readers recognize purpose signals',
      ],
      keyPoints: [
        'Calling as relationship',
        'Burden, gifting, and obedience',
        'Discernment through scripture and prayer',
      ],
      estimatedWordCount: 1800,
    },
    {
      number: 4,
      title: 'Purpose in Formation',
      objectives: [
        'Show how process forms capacity',
        'Encourage patience during hidden seasons',
      ],
      keyPoints: [
        'Preparation and pruning',
        'Character as infrastructure',
        'Learning faithfulness in small things',
      ],
      estimatedWordCount: 1800,
    },
    {
      number: 5,
      title: 'Serving the World With What You Carry',
      objectives: [
        'Connect personal purpose to service',
        'Move the reader from self-discovery to contribution',
      ],
      keyPoints: [
        'Purpose blesses others',
        'Gifts as stewardship',
        'Impact through obedience',
      ],
      estimatedWordCount: 1800,
    },
    {
      number: 6,
      title: 'Living Aligned',
      objectives: [
        'Provide practical next steps',
        'Call the reader into a purposeful life rhythm',
      ],
      keyPoints: [
        'Daily alignment',
        'Courage to obey',
        'Purpose as a life of communion and assignment',
      ],
      estimatedWordCount: 1500,
    },
  ];
}

