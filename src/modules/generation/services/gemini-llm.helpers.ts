import { GenerationEvaluationResult, LLMGenerationRequest } from './gemini-llm.types';

export const buildFullPrompt = (request: LLMGenerationRequest): string =>
  `${request.systemPrompt}\n\n---USER REQUEST---\n\n${request.userMessage}`;

export const createGenerationConfig = (request: LLMGenerationRequest) => ({
  temperature: request.temperature ?? 0.7,
  maxOutputTokens: request.maxTokens ?? 4000,
  topP: 0.95,
  topK: 64,
});

export const resolveGeminiModel = (requestModel?: string): string =>
  requestModel || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

export const extractTextFromResponse = (response: any): string => {
  try {
    const text = response?.text;
    if (typeof text === 'string' && text.length > 0) {
      return text;
    }

    const candidates = response?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return '';
    }

    const candidateContent = candidates[0]?.content;
    if (!candidateContent || !Array.isArray(candidateContent.parts)) {
      return '';
    }

    return candidateContent.parts.map((part: any) => part.text || '').join('');
  } catch {
    return '';
  }
};

export const createEvaluationPrompt = (
  originalPrompt: string,
  generatedContent: string,
): string =>
  `You are a rigorous quality evaluator for Christian ministry content.\n\nORIGINAL REQUEST:\n${originalPrompt}\n\nGENERATED CONTENT:\n${generatedContent}\n\nEvaluate this content for:\n1. Voice Consistency: Does it authentically match the requested voice and style?\n2. Doctrinal Alignment: Is it theologically sound and consistent with Christian orthodoxy?\n3. Faith Guardrails: Are there any concerning doctrinal drifts or problematic passages?\n4. Scripture Integration: Are scriptures handled respectfully and contextually?\n5. Clarity: Is the message clear and edifying?\n\nRespond in JSON format:\n{\n  "isApproved": boolean,\n  "issues": [string array of concerns],\n  "suggestions": [string array of improvement ideas],\n  "score": number (0-100)\n}`;

export const parseEvaluationResult = (
  evalText: string,
): GenerationEvaluationResult => {
  const jsonMatch = evalText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      isApproved: true,
      issues: [],
      score: 75,
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as GenerationEvaluationResult;
  } catch {
    return {
      isApproved: true,
      issues: [],
      score: 75,
    };
  }
};

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
