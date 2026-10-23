import { retrieveContextForGeneration } from './rag.context';

export async function buildOutlinePrompt(
  prisma: any,
  embeddings: any,
  repo: any,
  userId: string,
  query: string,
  voiceProfileId: string,
) {
  const voiceProfile = await prisma.voiceProfile.findUnique({ where: { id: voiceProfileId } });
  if (!voiceProfile) throw new Error(`Voice profile not found: ${voiceProfileId}`);

  const context = await retrieveContextForGeneration(embeddings, repo, userId, query, 3);

  let prompt = `You are writing an outline for a Christian ministry book.\n\n`;

  const ministryContext = voiceProfile.ministryDNA || (voiceProfile as any).theologicalFramework;
  if (ministryContext) prompt += `Ministry DNA / Theological Framework: ${ministryContext}\n`;
  if ((voiceProfile as any).voiceThemes?.length > 0) prompt += `Core Voice Themes: ${(voiceProfile as any).voiceThemes.join(', ')}\n`;
  if ((voiceProfile as any).keyMessages?.length > 0) prompt += `Key Messages: ${(voiceProfile as any).keyMessages.join(' | ')}\n`;
  if ((voiceProfile as any).toneMarkers?.length > 0) prompt += `Tone Markers: ${(voiceProfile as any).toneMarkers.join(', ')}\n`;
  if (voiceProfile.signaturePhrases?.length > 0) prompt += `Signature Phrases to use: ${voiceProfile.signaturePhrases.join(', ')}\n`;
  if (voiceProfile.anchorScriptures?.length > 0) prompt += `Anchor Scriptures: ${voiceProfile.anchorScriptures.join(', ')}\n`;

  if (context.allContext.length > 0) {
    prompt += `\nRelevant Voice Profile Insights:\n`;
    context.voiceContext.forEach((chunk: any) => { prompt += `- ${chunk.text}\n`; });

    if (context.scriptureContext.length > 0) {
      prompt += `\nRelevant Scriptures:\n`;
      context.scriptureContext.forEach((scripture: any) => { prompt += `- ${scripture.reference}: ${scripture.text}\n`; });
    }
  }

  prompt += `\nUser Request: ${query}\n`;
  prompt += `\nGenerate a detailed outline that reflects the author's voice and incorporates the insights above.`;

  return prompt;
}

export async function buildManuscriptPrompt(
  prisma: any,
  embeddings: any,
  repo: any,
  userId: string,
  chapterTitle: string,
  outline: string,
  voiceProfileId: string,
) {
  const voiceProfile = await prisma.voiceProfile.findUnique({ where: { id: voiceProfileId } });
  if (!voiceProfile) throw new Error(`Voice profile not found: ${voiceProfileId}`);

  const context = await retrieveContextForGeneration(embeddings, repo, userId, chapterTitle, 5);

  let prompt = `You are ghostwriting a chapter for a Christian ministry book.\n\n`;
  prompt += `Author: ${voiceProfile.name}\n`;
  if (voiceProfile.biography) prompt += `Background: ${voiceProfile.biography}\n`;

  const ministryCtx = voiceProfile.ministryDNA || (voiceProfile as any).theologicalFramework;
  if (ministryCtx) prompt += `Ministry DNA / Theological Framework: ${ministryCtx}\n`;
  if ((voiceProfile as any).voiceThemes?.length > 0) prompt += `Core Voice Themes: ${(voiceProfile as any).voiceThemes.join(', ')}\n`;
  if ((voiceProfile as any).keyMessages?.length > 0) prompt += `Key Messages: ${(voiceProfile as any).keyMessages.join(' | ')}\n`;
  if ((voiceProfile as any).toneMarkers?.length > 0) prompt += `Tone Markers: ${(voiceProfile as any).toneMarkers.join(', ')}\n`;
  if ((voiceProfile as any).recurringMotifs?.length > 0) prompt += `Recurring Motifs: ${(voiceProfile as any).recurringMotifs.join(', ')}\n`;
  if (voiceProfile.signaturePhrases?.length > 0) prompt += `Signature Phrases: ${voiceProfile.signaturePhrases.join(', ')}\n`;
  if (voiceProfile.anchorScriptures?.length > 0) prompt += `Key Scriptures: ${voiceProfile.anchorScriptures.join(', ')}\n`;

  if (context.allContext.length > 0) {
    prompt += `\nAuthor's Previous Writings on Related Topics:\n`;
    context.voiceContext.forEach((chunk: any) => { prompt += `- "${chunk.text}"\n`; });

    if (context.scriptureContext.length > 0) {
      prompt += `\nRelevant Scripture References:\n`;
      context.scriptureContext.forEach((scripture: any) => { prompt += `- ${scripture.reference}: ${scripture.text}\n`; });
    }
  }

  prompt += `\nChapter Title: ${chapterTitle}\n`;
  prompt += `Book Outline:\n${outline}\n`;
  prompt += `\nWrite this chapter in the author's voice, incorporating their theological perspective, signature phrases, and key scriptures. The chapter should be approximately 2000-3000 words and deeply resonate with readers in apostolic, prophetic, and Spirit-filled ministry contexts.`;

  return prompt;
}
