export function buildRequestConfig(systemPrompt: string, toolDeclarations: any[]) {
  return {
    model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toolDeclarations }],
      temperature: 0.7,
      maxOutputTokens: 4000,
      topP: 0.95,
    },
  };
}

export function buildContents(history: Array<{ role: string; content: string }>, newUserMessage: string) {
  const contents: any[] = history.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: newUserMessage }] });
  return contents;
}

export function extractText(response: any): string {
  try {
    const text = response.text;
    if (typeof text === 'string' && text.length > 0) return text;
    const candidates = response.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;
      if (Array.isArray(parts)) return parts.map((p: any) => p.text || '').join('');
    }
  } catch {
    // fall through
  }
  return '';
}

export function extractFunctionCalls(response: any): Array<{ name: string; args: Record<string, any> }> {
  try {
    if (typeof response.functionCalls === 'function') {
      const calls = response.functionCalls();
      if (Array.isArray(calls)) return calls;
    }
    const candidates = response.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts || [];
      return parts.filter((p: any) => p.functionCall).map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
    }
  } catch {
    // fall through
  }
  return [];
}

export function getToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    get_manuscripts_count: 'manuscript count tool',
    list_manuscripts: 'manuscript library tool',
    list_voice_profiles: 'voice profile tool',
    get_manuscript_details: 'manuscript details tool',
    search_user_knowledge: 'voice and knowledge base tool',
    generate_manuscript_or_book: 'manuscript outline tool',
    run_frontend_action: 'page action tool',
  };
  return names[toolName] || `${toolName.replace(/_/g, ' ')} tool`;
}

export function collectToolMetadata(toolName: string, result: string, metadata: Record<string, any>) {
  try {
    const parsedResult = JSON.parse(result);
    if (toolName === 'list_manuscripts' && parsedResult.manuscripts) metadata.manuscriptData = parsedResult.manuscripts;
    else if (toolName === 'list_voice_profiles' && parsedResult.profiles) metadata.profileData = parsedResult.profiles;
    else if (toolName === 'get_manuscript_details' && parsedResult.manuscript) metadata.manuscriptDetailData = parsedResult.manuscript;
    else if (toolName === 'generate_manuscript_or_book' && parsedResult.success) metadata.generatedOutlineData = { manuscriptId: parsedResult.manuscriptId, manuscriptTitle: parsedResult.manuscriptTitle, outlineId: parsedResult.outlineId };
    else if (toolName === 'search_user_knowledge' && parsedResult.success) { metadata.userKnowledgeSearched = true; metadata.searchTopic = parsedResult.topic; }
    else if (toolName === 'run_frontend_action' && parsedResult.frontendAction) metadata.frontendActions = [...(metadata.frontendActions || []), parsedResult.frontendAction];
  } catch {
    // ignore non-JSON tool results
  }
}

export function enhanceResponseWithNavigation(responseContent: string, metadata: any, context?: Record<string, any>) {
  let enhanced = responseContent;
  if (metadata.manuscriptData && metadata.manuscriptData.length > 0) {
    const links = metadata.manuscriptData.map((m: any) => `[${m.title}](/manuscripts/${m.id})`).join(' • ');
    enhanced += `\n\nYou can access your manuscripts directly:\n${links}`;
  }
  if (metadata.profileData && metadata.profileData.length > 0) {
    const profileLinks = metadata.profileData.map((p: any) => `[${p.name} Profile](/voice-profiles/${p.id})`).join(' • ');
    enhanced += `\n\nYour voice profiles:\n${profileLinks}`;
    if (metadata.profileData.length > 0) {
      const firstProfileId = metadata.profileData[0].id;
      enhanced += `\n\nOr [continue interview](/interview/${firstProfileId}) to further refine your voice.`;
    }
  }
  if (metadata.manuscriptDetailData) {
    const m = metadata.manuscriptDetailData;
    enhanced += `\n\n[View Manuscript](/manuscripts/${m.id}) to continue working on "${m.title}".`;
  }
  return enhanced;
}
