import { extractTextFromResponse, formatRagFallbackResponse } from './rag.helpers';
import { retrieveContextForGeneration } from './rag.context';

export async function synthesizeUserOpinion(
  genAI: any,
  prisma: any,
  embeddings: any,
  repo: any,
  logger: any,
  userId: string,
  topic: string,
) {
  const voiceProfiles = await prisma.voiceProfile.findMany({ where: { userId }, select: { id: true, name: true, ministryDNA: true, voiceThemes: true, keyMessages: true, toneMarkers: true, recurringMotifs: true, writingStyle: true, signaturePhrases: true, anchorScriptures: true, biography: true, sampleTexts: true, theologicalFramework: true } });

  if (voiceProfiles.length === 0) {
    return `I don't have enough information about you yet. Please create a voice profile first so I can understand your perspective and writing style.`;
  }

  const ragContext = await retrieveContextForGeneration(embeddings, repo, userId, topic, 10);

  const primaryProfile = voiceProfiles[0];

  const ministryIdentity = (primaryProfile as any).ministryDNA || (primaryProfile as any).theologicalFramework || 'Not specified';
  const voiceThemes = ((primaryProfile as any).voiceThemes as string[] | undefined) || [];
  const keyMessages = ((primaryProfile as any).keyMessages as string[] | undefined) || [];
  const toneMarkers = ((primaryProfile as any).toneMarkers as string[] | undefined) || [];
  const recurringMotifs = ((primaryProfile as any).recurringMotifs as string[] | undefined) || [];
  const writingStyle = (primaryProfile as any).writingStyle as { tone?: string; rhythm?: string } | undefined;

  const contextPrompt = `You are speaking as ${primaryProfile.name}, a Christian author with the following characteristics:\n\nTHEOLOGICAL VOICE:\n- Ministry DNA: ${ministryIdentity}\n${voiceThemes.length > 0 ? `- Core Themes: ${voiceThemes.join(', ')}` : ''}\n${keyMessages.length > 0 ? `- Key Messages: ${keyMessages.join(' | ')}` : ''}\n${toneMarkers.length > 0 ? `- Tone Markers: ${toneMarkers.join(', ')}` : ''}\n${recurringMotifs.length > 0 ? `- Recurring Motifs: ${recurringMotifs.join(', ')}` : ''}\n${writingStyle ? `- Writing Tone: ${writingStyle.tone || ''}\n- Rhythm: ${writingStyle.rhythm || ''}` : ''}\n- Signature Phrases: ${primaryProfile.signaturePhrases?.join(', ') || 'None recorded'}\n- Key Scriptures: ${primaryProfile.anchorScriptures?.join(', ') || 'None recorded'}\n- Biography: ${primaryProfile.biography || 'Not specified'}\n\nTHE USER'S PREVIOUS THOUGHTS ON "${topic}":\n${ragContext.voiceContext.map((chunk: any) => `• "${chunk.text}"`).join('\n')}\n\nRELEVANT SCRIPTURE REFERENCES:\n${ragContext.scriptureContext.map((scripture: any) => `• ${scripture.reference}: ${scripture.text}`).join('\n')}\n\nBased on this context, synthesize a natural, authentic response to the question: "What is your opinion/perspective on ${topic}?"\n\nThe response should:\n1. Sound exactly like this author (use their signature phrases, theological framework, tone)\n2. Integrate their previous thoughts naturally (not as bullet points)\n3. Reference the key scriptures where relevant\n4. Be 2-3 paragraphs that flow naturally as if the author is speaking\n5. Be conversational yet theologically sound\n\nIMPORTANT: Do not mention that you're pulling from "voice profiles" or "previous writings". Just speak naturally as the author.`;

  if (!genAI) {
    logger.warn('Gemini model not available, returning formatted context');
    return formatRagFallbackResponse(primaryProfile, ragContext);
  }

  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

  const response = await genAI.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: contextPrompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 2000 } } as any);

  const synthesizedResponse = extractTextFromResponse(response);
  if (!synthesizedResponse) return formatRagFallbackResponse(primaryProfile, ragContext);
  return synthesizedResponse;
}
