export function extractTextFromResponse(response: any): string {
  try {
    const text = response.text;
    if (typeof text === 'string' && text.length > 0) return text;
    const candidates = response.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (Array.isArray(parts)) {
        return parts.map((p: any) => p.text || '').join('');
      }
    }
  } catch {
    // fall through
  }
  return '';
}

export function formatRagFallbackResponse(profile: any, ragContext: any): string {
  let response = `Based on my understanding of your perspective on this topic:\n\n`;

  if (ragContext.voiceContext?.length > 0) {
    response += `My previous thoughts:\n`;
    ragContext.voiceContext.forEach((chunk: any) => {
      response += `"${chunk.text}"\n\n`;
    });
  }

  if (ragContext.scriptureContext?.length > 0) {
    response += `Key scripture references:\n`;
    ragContext.scriptureContext.forEach((scripture: any) => {
      response += `${scripture.reference}: ${scripture.text}\n`;
    });
  }

  return response;
}
