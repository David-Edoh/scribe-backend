import { Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import {
  GenerationEvaluationResult,
  LLMGenerationRequest,
  LLMGenerationResponse,
  LLMGenerationStreamChunk,
} from './gemini-llm.types';
import {
  buildFullPrompt,
  createEvaluationPrompt,
  createGenerationConfig,
  extractTextFromResponse,
  parseEvaluationResult,
  resolveGeminiModel,
} from './gemini-llm.helpers';
import { withStreamRetry } from './gemini-llm.retry';

export async function generateChapterResponse(
  genAI: GoogleGenAI,
  request: LLMGenerationRequest,
): Promise<LLMGenerationResponse> {
  const fullPrompt = buildFullPrompt(request);
  const generationConfig = createGenerationConfig(request);
  const model = resolveGeminiModel(request.model);

  const response = await genAI.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig,
  } as any);

  const textContent = extractTextFromResponse(response);
  if (!textContent) {
    throw new Error('No content generated from Gemini');
  }

  const usageMetadata = (response as any).usageMetadata || {};
  return {
    content: textContent,
    model,
    tokensUsed: {
      input: usageMetadata.promptTokenCount || 0,
      output: usageMetadata.candidatesTokenCount || 0,
    },
    finishReason: (response as any).candidates?.[0]?.finishReason || 'STOP',
  };
}

export async function* streamChapterResponse(
  genAI: GoogleGenAI,
  request: LLMGenerationRequest,
  logger: Logger,
): AsyncGenerator<LLMGenerationStreamChunk> {
  const fullPrompt = buildFullPrompt(request);
  const model = resolveGeminiModel(request.model);
  const generationConfig = createGenerationConfig(request);
  let fullContent = '';

  for await (const chunk of withStreamRetry(
    async () =>
      genAI.models.generateContentStream({
        model,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig,
      } as any),
    logger,
  )) {
    const content = extractTextFromResponse(chunk);
    if (!content) continue;

    fullContent += content;
    yield {
      content,
      fullContent,
      model,
      finishReason: (chunk as any).candidates?.[0]?.finishReason || undefined,
    };
  }
}

export async function evaluateGeneratedContent(
  genAI: GoogleGenAI,
  originalPrompt: string,
  generatedContent: string,
): Promise<GenerationEvaluationResult> {
  const evaluationPrompt = createEvaluationPrompt(originalPrompt, generatedContent);
  const response = await genAI.models.generateContent({
    model: resolveGeminiModel(undefined),
    contents: [
      {
        role: 'user',
        parts: [{ text: evaluationPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  } as any);

  const evalText = extractTextFromResponse(response);
  return parseEvaluationResult(evalText);
}
